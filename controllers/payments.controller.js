import Stripe from "stripe";
import crypto from "crypto";
import nodemailer from "nodemailer";
import Room from "../models/Room.js";
import Hostel from "../models/Hostel.js";
import User from "../models/Users.js";
import Booking from "../models/Booking.js";
import { getStudentBookingEmail } from "../emails/studentBookingEmail.js";
import { getOwnerBookingEmail } from "../emails/ownerBookingEmail.js";
import { getAdminBookingEmail } from "../emails/adminBookingEmail.js";

let stripe = null;
if (process.env.STRIPE_SECRET) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET);
  } catch (e) {
    console.warn("Failed to initialize Stripe:", e.message || e);
    stripe = null;
  }
} else {
  console.warn("STRIPE_SECRET not set — Stripe features disabled");
}

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

function buildFrontendBaseUrl(req) {
  const fromClientUrl = process.env.CLIENT_URL;
  const fromOrigin = req?.headers?.origin;
  const fromReferer = req?.headers?.referer;

  if (isValidWebUrl(fromClientUrl)) return fromClientUrl.replace(/\/+$/, "");
  if (isValidWebUrl(fromOrigin)) return fromOrigin.replace(/\/+$/, "");

  if (isValidWebUrl(fromReferer)) {
    try {
      const parsed = new URL(fromReferer);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      // ignore parse errors and fallback below
    }
  }

  return "http://localhost:5173";
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
      startDate,
      bedsBooked,
    } = req.body;

    let line_items;

    // If a roomId is provided, fetch the real room price and use it
    let room = null;
    if (roomId) {
      room = await Room.findById(roomId).populate("hostelId");
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
        startDate: startDate || "",
        bedsBooked: String(bedsBooked || quantity || 1),
        userId: req.user ? req.user.id : "",
      };

      // If the current user is a student, include a one-time admission fee
      // plus a service fee. New split: service fee Rs1000 to platform (admin),
      // admission fee Rs2000 to hostel owner.
      try {
        if (req.user && String(req.user.role) === "student") {
          const serviceAmount = 1000; // PKR
          const admissionAmount = 2000; // PKR
          const bedsQty = parseInt(quantity, 10) || 1;
          const securityPerBed = Number(room.pricePerBed || 0);
          const securityAmount = securityPerBed * bedsQty; // PKR

          // Service fee (platform)
          line_items.push({
            price_data: {
              currency,
              product_data: {
                name: "Service fee",
                description: "Platform service fee",
              },
              unit_amount: Math.round(serviceAmount * 100),
            },
            quantity: 1,
          });

          // Admission fee (one-time) for hostel
          line_items.push({
            price_data: {
              currency,
              product_data: {
                name: "Admission fee (one-time)",
                description: "One-time admission/registration fee",
              },
              unit_amount: Math.round(admissionAmount * 100),
            },
            quantity: 1,
          });

          // Security fee (typically refundable) based on per-bed price
          line_items.push({
            price_data: {
              currency,
              product_data: {
                name: "Security fee",
                description: "Security deposit charged at checkout",
              },
              unit_amount: Math.round(securityPerBed * 100),
            },
            quantity: bedsQty,
          });

          // annotate metadata so we can split after payment
          sessionMetadata.serviceFee = String(serviceAmount);
          sessionMetadata.serviceAdmin = String(serviceAmount);
          sessionMetadata.admissionFee = String(admissionAmount);
          sessionMetadata.admissionOwner = String(admissionAmount);
          sessionMetadata.securityFee = String(securityAmount);
          sessionMetadata.securityPerBed = String(securityPerBed);
        }
      } catch (e) {
        // non-blocking
        console.warn("Failed to append fee metadata:", e && e.message ? e.message : e);
      }
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

    // Validate provided success/cancel URLs (if any)
    if (successUrl && !isValidWebUrl(successUrl)) {
      return res.status(400).json({ message: "Invalid successUrl provided" });
    }
    if (cancelUrl && !isValidWebUrl(cancelUrl)) {
      return res.status(400).json({ message: "Invalid cancelUrl provided" });
    }

    const frontendBase = buildFrontendBaseUrl(req);
    const resolvedSuccessUrl =
      successUrl ||
      `${frontendBase}/booking-success?session_id={CHECKOUT_SESSION_ID}`;
    const resolvedCancelUrl = cancelUrl || `${frontendBase}/payment-cancel`;

    const sessionParams = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
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
      // Add non-identifying hash of the user's email for internal tracing (avoids storing raw PII)
      if (req.user && req.user.email) {
        try {
          sessionMetadata.userEmailHash = crypto
            .createHash("sha256")
            .update(String(req.user.email))
            .digest("hex");
        } catch (e) {
          // ignore hashing errors
        }
      }

      sessionParams.metadata = sessionMetadata;
      sessionParams.client_reference_id = roomId;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "Stripe sessionParams:",
        JSON.stringify(sessionParams, null, 2),
      );
    }

    // Ensure we never send the user's raw login email to Stripe Checkout session
    if (sessionParams.customer_email) delete sessionParams.customer_email;

    // --- Stripe Connect destination charge (owner payout) ---
    // If the hostel owner has a Stripe Connect account ID (acct_xxx), route
    // funds directly to their account while the platform keeps the service fee.
    // The session is ALWAYS created on the PLATFORM Stripe so the platform
    // webhook fires reliably for every payment.
    // If the owner has no Connect account, all funds stay on the platform.
    try {
      if (room && room.hostelId && room.hostelId.ownerId) {
        const owner = await User.findById(room.hostelId.ownerId).select("stripe");
        const ownerAccountId = owner && owner.stripe && owner.stripe.accountId
          ? String(owner.stripe.accountId).trim()
          : "";

        if (ownerAccountId && /^acct_/.test(ownerAccountId)) {
          // Calculate the platform application fee = service fee only (in paisa).
          // Everything else (room price, admission fee, security fee) goes to owner.
          const serviceFeeAmt = sessionMetadata && sessionMetadata.serviceFee
            ? Math.round(Number(sessionMetadata.serviceFee) * 100)
            : 0;

          sessionParams.payment_intent_data = {
            application_fee_amount: serviceFeeAmt,
            transfer_data: {
              destination: ownerAccountId,
            },
          };

          // Store the Connect account ID in metadata for reference
          if (sessionParams.metadata) {
            sessionParams.metadata.ownerStripeAccountId = ownerAccountId;
          }

          console.log(
            `Destination charge: funds → ${ownerAccountId}, platform fee = ${serviceFeeAmt} paisa`,
          );
        }
      }
    } catch (connectErr) {
      // Non-blocking: if Connect lookup fails, fall back to platform-only payment
      console.warn(
        "Connect account lookup failed, falling back to platform-only:",
        connectErr.message || connectErr,
      );
    }

    let session;
    try {
      // Always create on PLATFORM Stripe — guarantees webhook fires every time.
      if (!stripe) {
        return res
          .status(500)
          .json({ message: "Stripe is not configured on the server" });
      }

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

export const finalizeBooking = async (req, res) => {
  try {
    const { sessionId, roomId, startDate, bedsBooked } = req.body;
    const userId = req.user.id;

    if (!sessionId || !roomId || !startDate || !bedsBooked) {
      return res.status(400).json({ message: "Missing required booking details" });
    }

    if (!stripe) {
      return res.status(500).json({ message: "Stripe not configured" });
    }

    // Idempotency: return existing booking if webhook already created it
    const existing = await Booking.findOne({ stripeSessionId: sessionId }).populate("hostelId", "name");
    if (existing) {
      console.log("Booking already exists for session", sessionId, "(webhook already fired)");
      return res.json({ success: true, booking: existing, source: "webhook" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const booking = await Booking.create({
      userId,
      hostelId: session.metadata?.hostelId,
      roomId,
      startDate: new Date(startDate),
      bedsBooked: parseInt(bedsBooked, 10),
      totalPrice: session.amount_total / 100,
      status: "confirmed",
      admissionFee: session.metadata?.admissionFee ? Number(session.metadata.admissionFee) : 0,
      admissionSplit: {
        owner: session.metadata?.admissionOwner ? Number(session.metadata.admissionOwner) : 0,
      },
      serviceFee: session.metadata?.serviceFee ? Number(session.metadata.serviceFee) : 0,
      serviceSplit: {
        admin: session.metadata?.serviceAdmin ? Number(session.metadata.serviceAdmin) : 0,
      },
      securityFee: session.metadata?.securityFee ? Number(session.metadata.securityFee) : 0,
      securityFeeStatus:
        session.metadata?.securityFee && Number(session.metadata.securityFee) > 0
          ? "held"
          : "not_applicable",
      stripeSessionId: sessionId,
    });

    // Resolve room label for emails (try metadata first, then DB by roomId)
    let roomLabel = (session.metadata && session.metadata.roomLabel) || "-";
    try {
      if (session.metadata && session.metadata.roomId) {
        const roomDoc = await Room.findById(session.metadata.roomId).select("roomLabel").lean();
        if (roomDoc && roomDoc.roomLabel) roomLabel = roomDoc.roomLabel;
      } else if (roomId) {
        const roomDoc = await Room.findById(roomId).select("roomLabel").lean();
        if (roomDoc && roomDoc.roomLabel) roomLabel = roomDoc.roomLabel;
      }
    } catch (e) {
      console.warn("Could not resolve room label for owner email:", e && e.message ? e.message : e);
    }

    // Note: Owner email will be sent in the unified fee-processing block below

      // Capture owner contact info for customer confirmation email
      let ownerName = "-";
      let ownerEmail = "-";
      let ownerPhone = "-";
      let hostelName = "-";
      try {
        const ownerHostelId = session.metadata?.hostelId;
        if (ownerHostelId) {
          const ownerHostel = await Hostel.findById(ownerHostelId).lean();
          if (ownerHostel) hostelName = ownerHostel.name || hostelName;
          if (ownerHostel?.ownerId) {
            const ownerUser = await User.findById(ownerHostel.ownerId)
              .select("email name phone")
              .lean();

            if (ownerUser) {
              ownerName = ownerUser.name || ownerName;
              ownerEmail = ownerUser.email || ownerEmail;
              ownerPhone = ownerUser.phone || ownerPhone;
            }
          }
        }
      } catch (err) {
        console.error("Failed to retrieve owner contact info:", err);
      }

      // Send customer confirmation email in fallback path (so students always receive owner contact)
      try {
        const customerEmail = session.customer_details?.email || session.customer_email || null;
        if (customerEmail) {
          const amountStr = session.amount_total ? (session.amount_total / 100).toFixed(2) + " " + (session.currency || "pkr").toUpperCase() : "-";
          const customerHtml = getStudentBookingEmail({
            hostelName,
            roomLabel,
            metadata: {
              ...(session.metadata || {}),
              startDate: session.metadata?.startDate || startDate || "-",
            },
            beds: parseInt(bedsBooked, 10) || 1,
            currency: session.currency || "pkr",
            admissionFee: Number(session.metadata?.admissionFee || 0),
            securityFee: Number(session.metadata?.securityFee || 0),
            serviceFee: Number(session.metadata?.serviceFee || 0),
            amount: session.amount_total,
            ownerName,
            ownerEmail,
            ownerPhone,
            supportEmail: process.env.ADMIN_EMAIL || "support",
          });

          await mailTransporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: customerEmail,
            subject: `Booking confirmed — ${process.env.APP_NAME || "Your Booking"}`,
            html: customerHtml,
          });
          console.log("Customer email sent to", customerEmail);
        }
      } catch (custErr) {
        console.error("Failed to send customer confirmation email (fallback):", custErr && custErr.message ? custErr.message : custErr);
      }

    await Room.findByIdAndUpdate(
      roomId,
      { $inc: { availableBeds: -parseInt(bedsBooked, 10) } },
      { new: true }
    );

      // If service/admission fees were present, credit admin (service)
      // and owner (admission) balances and send emails
      try {
        const serviceFee = session.metadata?.serviceFee ? Number(session.metadata.serviceFee) : 0;
        const serviceAdminAmt = session.metadata?.serviceAdmin ? Number(session.metadata.serviceAdmin) : 0;
        const admissionFee = session.metadata?.admissionFee ? Number(session.metadata.admissionFee) : 0;
        const admissionOwnerAmt = session.metadata?.admissionOwner ? Number(session.metadata.admissionOwner) : 0;
        const securityFee = session.metadata?.securityFee ? Number(session.metadata.securityFee) : 0;

        // Credit admin with service fee
        if (serviceFee > 0 && serviceAdminAmt > 0) {
          try {
            let adminUser = null;
            if (process.env.ADMIN_EMAIL) adminUser = await User.findOne({ email: process.env.ADMIN_EMAIL });
            if (!adminUser) adminUser = await User.findOne({ role: 'admin' });
            if (adminUser) {
              adminUser.balance = (adminUser.balance || 0) + serviceAdminAmt;
              await adminUser.save();

              if (adminUser.email) {
                const adminHtml = getAdminBookingEmail({
                  hostelName: hostelName || '-',
                  metadata: {
                    ...(session.metadata || {}),
                    startDate: session.metadata?.startDate || startDate || '-',
                  },
                  roomLabel: roomLabel || '-',
                  beds: parseInt(bedsBooked, 10) || 1,
                  serviceFee,
                  admissionFee,
                  securityFee,
                  serviceAdminAmt,
                });
                await mailTransporter.sendMail({
                  from: process.env.FROM_EMAIL || process.env.SMTP_USER,
                  to: adminUser.email,
                  subject: `Booking received & service fee credited — ${process.env.APP_NAME || 'Intellistay'}`,
                  html: adminHtml,
                });
              }
            }
          } catch (e) {
            console.error('Failed to credit admin or send admin email:', e && e.message ? e.message : e);
          }
        }

        // Credit owner with admission fee
        if (admissionFee > 0 && admissionOwnerAmt > 0) {
          try {
            const ownerHostelId = session.metadata?.hostelId;
            if (ownerHostelId) {
              const ownerHostel = await Hostel.findById(ownerHostelId).lean();
              if (ownerHostel?.ownerId) {
                const ownerUser = await User.findById(ownerHostel.ownerId).select('email name balance').exec();
                if (ownerUser) {
                  ownerUser.balance = (ownerUser.balance || 0) + admissionOwnerAmt;
                  await ownerUser.save();

                  if (ownerUser.email) {
                    const ownerHtml = getOwnerBookingEmail({
                      ownerUser,
                      ownerHostel,
                      metadata: {
                        ...(session.metadata || {}),
                        startDate: session.metadata?.startDate || startDate || '-',
                      },
                      roomLabel,
                      bedsBooked: parseInt(bedsBooked, 10) || 1,
                      serviceFee,
                      admissionFee,
                      securityFee,
                      admissionOwnerAmt,
                      customerName: session.customer_details?.name || '-',
                      customerEmail: session.customer_details?.email || session.customer_email || '-',
                    });
                    await mailTransporter.sendMail({
                      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
                      to: ownerUser.email,
                      subject: `Booking received & fees credited — ${process.env.APP_NAME || 'Intellistay'}`,
                      html: ownerHtml,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to credit owner or send owner email:', e && e.message ? e.message : e);
          }
        }
      } catch (e) {
        console.error('Fee processing error:', e && e.message ? e.message : e);
      }

    console.log("Booking finalized (fallback, webhook didn't fire):", booking._id);

    await booking.populate("hostelId", "name");
    res.json({ success: true, booking, source: "fallback" });
  } catch (err) {
    // Duplicate key means webhook created it between our check and create — return it
    if (err.code === 11000) {
      const booking = await Booking.findOne({ stripeSessionId: req.body.sessionId }).populate("hostelId", "name");
      if (booking) return res.json({ success: true, booking, source: "webhook" });
    }
    console.error("Error finalizing booking:", err);
    res.status(500).json({ success: false, message: "Failed to finalize booking", error: err.message });
  }
};

export const getBookingBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const booking = await Booking.findOne({ stripeSessionId: sessionId }).populate("hostelId", "name");
    if (!booking) {
      return res.status(404).json({ found: false });
    }
    res.json({ found: true, booking });
  } catch (err) {
    res.status(500).json({ found: false, message: err.message });
  }
};
