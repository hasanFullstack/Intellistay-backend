import Stripe from "stripe";
import nodemailer from "nodemailer";
import Room from "../models/Room.js";
import Hostel from "../models/Hostel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET);

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

// Basic URL validator: ensures http(s) and enforces a maximum length
function isValidWebUrl(u, maxLen = 2048) {
  if (!u || typeof u !== "string") return false;
  if (u.length > maxLen) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

export const sendTestEmail = async (req, res) => {
  try {
    console.log(process.env.SMTP_PASS);

    const to =
      req.body?.to ||
      req.query?.to ||
      process.env.ADMIN_EMAIL ||
      process.env.SMTP_USER;

    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS
    ) {
      return res.status(400).json({
        message: "SMTP configuration is missing in .env",
      });
    }

    if (!to) {
      return res.status(400).json({
        message:
          "Recipient email is required. Pass `to` in query or request body.",
      });
    }

    await mailTransporter.verify();

    const info = await mailTransporter.sendMail({
      from: `${process.env.APP_NAME || "Intellistay"} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject: `SMTP test from ${process.env.APP_NAME || "Intellistay"}`,
      text: "This is a test email to verify that SMTP sending is working correctly.",
      html: `
        <h2>SMTP Test Successful</h2>
        <p>This is a test email from <strong>${process.env.APP_NAME || "Intellistay"}</strong>.</p>
        <p>If you received this, your SMTP settings are working.</p>
        <hr />
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      `,
    });

    return res.json({
      message: "Test email sent successfully",
      to,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error) {
    console.error("Test email send failed:", error);

    if (
      error?.code === "EAUTH" ||
      /username and password not accepted|invalid login/i.test(
        error?.message || "",
      )
    ) {
      return res.status(401).json({
        message:
          "Gmail SMTP authentication failed. Enable 2-Step Verification and use a valid Gmail App Password in SMTP_PASS.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Failed to send test email",
      error: error.message,
    });
  }
};

export const createCheckoutSession = async (req, res, next) => {
  try {
    const {
      items,
      roomId,
      quantity = 1,
      successUrl,
      cancelUrl,
      currency = "pkr",
    } = req.body;

    let line_items;

    // If a roomId is provided, fetch the real room price and use it
    if (roomId) {
      const room = await Room.findById(roomId).populate("hostelId");
      if (!room) return res.status(404).json({ message: "Room not found" });

      const hostelName =
        room.hostelId && room.hostelId.name ? room.hostelId.name : "Hostel";
      const productName = `${hostelName} - ${room.roomType} (per bed)`;
      const unitAmount = Math.round((room.pricePerBed || 0) * 100); // convert to paisa

      // Resolve image URL: prefer absolute http(s) URLs. Skip data URIs
      // and extremely long values that would make the Checkout Session fail.
      const serverBase =
        process.env.SERVER_URL ||
        process.env.CLIENT_URL ||
        `http://localhost:${process.env.PORT || 5000}`;
      let imageUrl = null;
      if (room.images && room.images.length) {
        const first = room.images[0];
        if (typeof first === "string") {
          const trimmed = first.trim();
          if (/^https?:\/\//i.test(trimmed)) {
            imageUrl = trimmed;
          } else if (/^data:/i.test(trimmed)) {
            imageUrl = null;
          } else {
            const candidate = `${serverBase.replace(/\/$/, "")}/${String(trimmed).replace(/^\/+/, "")}`;
            if (candidate.length <= 1900) imageUrl = candidate;
          }
        }
      }

      // Build a rich description with room and hostel details
      const descParts = [];
      if (room.description) descParts.push(room.description);
      descParts.push(`Type: ${room.roomType}`);
      if (room.totalBeds) descParts.push(`Total beds: ${room.totalBeds}`);
      if (room.availableBeds !== undefined)
        descParts.push(`Available: ${room.availableBeds}`);
      const hostel = room.hostelId;
      if (hostel && hostel.gender) descParts.push(`Gender: ${hostel.gender}`);
      const productDescription = descParts.join(" | ");

      line_items = [
        {
          price_data: {
            currency,
            product_data: {
              name: productName,
              description: productDescription,
              images: imageUrl ? [imageUrl] : [],
            },
            unit_amount: unitAmount,
          },
          quantity: parseInt(quantity, 10) || 1,
        },
      ];

      // Attach metadata for later reference (keeps full details accessible in webhooks and dashboard)
      var sessionMetadata = {
        roomId: room._id.toString(),
        hostelId: room.hostelId ? room.hostelId._id.toString() : "",
        pricePerBed: String(room.pricePerBed || ""),
        roomType: room.roomType || "",
        totalBeds: String(room.totalBeds || ""),
        availableBeds: String(room.availableBeds || ""),
        gender: (hostel && hostel.gender) || "",
      };
    } else if (items && items.length) {
      line_items = items.map((it) => ({
        price_data: {
          currency: it.currency || currency,
          product_data: { name: it.name || "Item" },
          unit_amount: Math.round((it.unit_amount || it.amount || 0) * 100),
        },
        quantity: it.quantity || 1,
      }));
    } else {
      line_items = [
        {
          price_data: {
            currency,
            product_data: { name: "Default Item" },
            unit_amount: 500 * 100,
          },
          quantity: 1,
        },
      ];
    }

    const sessionParams = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: "http://localhost:5173/success",
      cancel_url: "http://localhost:5173/cancel",
    };

    // Sanitize image URLs in line_items: Stripe rejects data: URIs or very long URLs.
    try {
      if (Array.isArray(sessionParams.line_items)) {
        sessionParams.line_items = sessionParams.line_items.map((li) => {
          const pd = li.price_data && li.price_data.product_data;
          if (pd && Array.isArray(pd.images)) {
            pd.images = pd.images.filter((img) => {
              if (typeof img !== "string") return false;
              const s = img.trim();
              if (!/^https?:\/\//i.test(s)) return false;
              return s.length <= 1900;
            });
          }
          return li;
        });
      }
    } catch (e) {
      // don't block checkout on sanitization errors; log in non-production
      if (process.env.NODE_ENV !== "production")
        console.warn("Image sanitization error:", e);
    }

    if (typeof sessionMetadata !== "undefined") {
      sessionParams.metadata = sessionMetadata;
      sessionParams.client_reference_id = roomId;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "Stripe sessionParams:",
        JSON.stringify(sessionParams, null, 2),
      );
    }

    // Validate provided success/cancel URLs (if any)
    if (successUrl && !isValidWebUrl(successUrl)) {
      return res.status(400).json({ message: "Invalid successUrl provided" });
    }
    if (cancelUrl && !isValidWebUrl(cancelUrl)) {
      return res.status(400).json({ message: "Invalid cancelUrl provided" });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeErr) {
      const status = stripeErr.statusCode || 400;
      const body = {
        message: stripeErr.message || "Stripe error",
      };
      if (stripeErr.type) body.type = stripeErr.type;
      if (stripeErr.code) body.code = stripeErr.code;
      if (process.env.NODE_ENV !== "production")
        body.raw = stripeErr.raw || null;
      return res.status(status).json({ message: body.message, details: body });
    }

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    next(err);
  }
};
