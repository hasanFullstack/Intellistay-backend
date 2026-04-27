import Stripe from "stripe";
import nodemailer from "nodemailer";
import Hostel from "../models/Hostel.js";
import User from "../models/Users.js";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

// Remove JSON / <pre> dumps and session id lines from customer-facing HTML
function sanitizeCustomerHtml(html) {
  if (!html || typeof html !== "string") return html;
  // remove any <pre>...</pre> blocks
  html = html.replace(/<pre>[\s\S]*?<\/pre>/gi, "");
  // remove any paragraph that contains 'Session ID'
  html = html.replace(/<p[^>]*>[^<]*Session ID[^<]*<\/p>/gi, "");
  // remove large JSON-like blocks between braces
  html = html.replace(/\{[\s\S]*?\}/g, "");
  return html;
}

export const handleStripeWebhook = async (req, res) => {
  if (!stripe) {
    console.error(
      "Stripe is not configured on the server. Webhook cannot be processed.",
    );
    return res.status(500).send("Stripe not configured");
  }
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("Checkout session completed", session.id);

        const customerEmail =
          session.customer_details?.email || session.customer_email || null;
        const amount = session.amount_total; // already in smallest currency unit
        const currency = session.currency || "pkr";
        const metadata = session.metadata || {};

        // Create booking record if we have the necessary details
        try {
          const { roomId, hostelId, userId, startDate, bedsBooked } = metadata;

          // Idempotency: don't create duplicate bookings for same Stripe session
          const existing = await Booking.findOne({ stripeSessionId: session.id });
          if (existing) {
            console.log("Booking already exists for session (webhook):", session.id);
            break;
          }

          if (roomId && hostelId && userId && startDate) {
            const booking = await Booking.create({
              userId,
              hostelId,
              roomId,
              startDate: new Date(startDate),
              bedsBooked: parseInt(bedsBooked || 1, 10),
              totalPrice: amount / 100, // convert from paisa to currency
              status: "confirmed",
              admissionFee: metadata?.admissionFee ? Number(metadata.admissionFee) : 0,
              admissionSplit: {
                owner: metadata?.admissionOwner ? Number(metadata.admissionOwner) : 0,
              },
              serviceFee: metadata?.serviceFee ? Number(metadata.serviceFee) : 0,
              serviceSplit: {
                admin: metadata?.serviceAdmin ? Number(metadata.serviceAdmin) : 0,
              },
              securityFee: metadata?.securityFee ? Number(metadata.securityFee) : 0,
              securityFeeStatus:
                metadata?.securityFee && Number(metadata.securityFee) > 0
                  ? "held"
                  : "not_applicable",
              stripeSessionId: session.id,
            });

            // Reduce available beds in the room
            await Room.findByIdAndUpdate(
              roomId,
              { $inc: { availableBeds: -parseInt(bedsBooked || 1, 10) } },
              { new: true },
            );

            console.log("Booking created via webhook:", booking._id);

            // Credit balances and send combined owner/admin emails if fees present
            try {
              const serviceFee = metadata?.serviceFee ? Number(metadata.serviceFee) : 0;
              const serviceAdminAmt = metadata?.serviceAdmin ? Number(metadata.serviceAdmin) : 0;
              const admissionFee = metadata?.admissionFee ? Number(metadata.admissionFee) : 0;
              const admissionOwnerAmt = metadata?.admissionOwner ? Number(metadata.admissionOwner) : 0;
              const securityFee = metadata?.securityFee ? Number(metadata.securityFee) : 0;

              // Credit admin
              if (serviceFee > 0 && serviceAdminAmt > 0) {
                try {
                  let adminUser = null;
                  if (process.env.ADMIN_EMAIL) adminUser = await User.findOne({ email: process.env.ADMIN_EMAIL });
                  if (!adminUser) adminUser = await User.findOne({ role: 'admin' });
                  if (adminUser) {
                    adminUser.balance = (adminUser.balance || 0) + serviceAdminAmt;
                    await adminUser.save();
                    // notify admin about service fee
                    if (adminUser.email) {
                      const adminHtml = getAdminBookingEmail({
                        hostelName: metadata?.hostelName || "-",
                        metadata,
                        roomLabel: metadata?.roomLabel || "-",
                        beds: parseInt(bedsBooked || 1, 10) || 1,
                        serviceFee,
                        admissionFee,
                        securityFee,
                        serviceAdminAmt,
                      });
                      await transporter.sendMail({
                        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
                        to: adminUser.email,
                        subject: `Service fee received — ${process.env.APP_NAME || 'Intellistay'}`,
                        html: adminHtml,
                      });
                    }
                  }
                } catch (e) {
                  console.error('Failed to credit admin in webhook:', e && e.message ? e.message : e);
                }
              }

              // Credit owner and send a single combined email
              if (admissionFee > 0 && admissionOwnerAmt > 0) {
                try {
                  const ownerHostelId = metadata?.hostelId;
                  if (ownerHostelId) {
                    const ownerHostel = await Hostel.findById(ownerHostelId).lean();
                    if (ownerHostel?.ownerId) {
                      const ownerUser = await User.findById(ownerHostel.ownerId).select('email name balance').exec();
                      if (ownerUser) {
                        ownerUser.balance = (ownerUser.balance || 0) + admissionOwnerAmt;
                        await ownerUser.save();

                        // send unified owner email with booking and fee breakdown
                        if (ownerUser.email) {
                          const ownerHtml = getOwnerBookingEmail({
                            ownerUser,
                            ownerHostel,
                            metadata,
                            roomLabel: metadata.roomLabel || "-",
                            bedsBooked: parseInt(bedsBooked || 1, 10) || 1,
                            serviceFee,
                            admissionFee,
                            securityFee,
                            admissionOwnerAmt,
                          });
                          await transporter.sendMail({
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
                  console.error('Failed to credit owner or send owner email in webhook:', e && e.message ? e.message : e);
                }
              }
            } catch (e) {
              console.error('Webhook fee processing error:', e && e.message ? e.message : e);
            }
          }
        } catch (bookingErr) {
          console.error(
            "Failed to create booking record:",
            bookingErr.message || bookingErr,
          );
        }

        // Build email content — resolve Room and Hostel names and room label to avoid showing raw IDs
        let roomName = metadata.roomName || "-";
        let hostelName = metadata.hostelName || "-";
        let roomLabel = metadata.roomLabel || "-";
        try {
          if (metadata.roomId) {
            const roomDoc = await Room.findById(metadata.roomId)
              .populate("hostelId", "name")
              .select("name roomLabel hostelId")
              .lean();
            if (roomDoc) {
              roomName = roomDoc.name || String(roomDoc._id);
              if (roomDoc.hostelId && roomDoc.hostelId.name)
                hostelName = roomDoc.hostelId.name;
              if (roomDoc.roomLabel) roomLabel = roomDoc.roomLabel;
            }
          } else if (metadata.hostelId) {
            const hostDoc = await Hostel.findById(metadata.hostelId)
              .select("name")
              .lean();
            if (hostDoc && hostDoc.name) hostelName = hostDoc.name;
          }
        } catch (nameErr) {
          console.warn(
            "Could not resolve room/hostel names:",
            nameErr.message || nameErr,
          );
        }

        // Resolve owner contact info for customer-facing email (populate with fallbacks)
        let ownerName = "-";
        let ownerEmail = "-";
        let ownerPhone = "-";
        try {
          // Prefer explicit hostelId in metadata; otherwise try to derive it from roomId
          let resolvedHostelId = metadata.hostelId || null;
          if (!resolvedHostelId && metadata.roomId) {
            try {
              const roomForHostel = await Room.findById(metadata.roomId).select("hostelId").lean();
              if (roomForHostel && roomForHostel.hostelId) resolvedHostelId = roomForHostel.hostelId;
            } catch (e) {
              // ignore and continue — we'll attempt lookup only if we have an id
            }
          }

          if (resolvedHostelId) {
            // Try populating owner in one query first
            const hostelDoc = await Hostel.findById(resolvedHostelId)
              .populate("ownerId", "name email phone")
              .select("ownerId")
              .lean();

            // If populate returned an object, use its fields
            if (hostelDoc && hostelDoc.ownerId) {
              const owner = hostelDoc.ownerId;
              if (typeof owner === "object") {
                ownerName = owner.name || ownerName;
                ownerEmail = owner.email || ownerEmail;
                ownerPhone = owner.phone || ownerPhone;
              } else if (typeof owner === "string") {
                // Fallback: ownerId is an id string — fetch user directly
                const ownerDoc = await User.findById(owner)
                  .select("name email phone")
                  .lean();
                if (ownerDoc) {
                  ownerName = ownerDoc.name || ownerName;
                  ownerEmail = ownerDoc.email || ownerEmail;
                  ownerPhone = ownerDoc.phone || ownerPhone;
                }
              }
            }
          }
        } catch (ownerErr) {
          console.warn(
            "Could not resolve owner contact info:",
            ownerErr && ownerErr.message ? ownerErr.message : ownerErr,
          );
        }

        const beds =
          parseInt(
            metadata.bedsBooked || metadata.beds || session.beds || 1,
            10,
          ) || 1;

        const roomDetailsHtml = `
          <h3>Booking Details</h3>
          <p><strong>Hostel:</strong> ${hostelName}</p>
          <p><strong>Room Number:</strong> ${roomLabel}</p>
          <p><strong>Type:</strong> ${metadata.roomType || "-"}</p>
          <p><strong>Price per bed:</strong> ${metadata.pricePerBed || "-"} ${currency.toUpperCase()}</p>
          <p><strong>Beds:</strong> ${beds}</p>
          <p><strong>Total:</strong> ${amount ? (amount / 100).toFixed(2) + " " + currency.toUpperCase() : "-"}</p>
        `;

        // Prepare session copies with metadata names and replace quantity with beds
        const sessionWithNames = JSON.parse(JSON.stringify(session));
        if (
          sessionWithNames.metadata &&
          typeof sessionWithNames.metadata === "object"
        ) {
          if (roomName) sessionWithNames.metadata.roomId = roomName;
          if (hostelName) sessionWithNames.metadata.hostelId = hostelName;
          sessionWithNames.metadata.bedsBooked = String(beds);
        }
        // normalize top-level quantity and line_items quantities to show beds
        try {
          sessionWithNames.quantity = beds;
          if (Array.isArray(sessionWithNames.line_items)) {
            sessionWithNames.line_items = sessionWithNames.line_items.map(
              (li) => ({
                ...li,
                quantity: beds,
              }),
            );
          }
        } catch (e) {
          // ignore normalization errors
        }

        // Send simplified email to customer (only booking details, no session ID or JSON)
        if (customerEmail) {
          console.log(
            "Preparing to send simplified customer email to",
            customerEmail,
          );
          const customerHtml = getStudentBookingEmail({
            hostelName,
            roomLabel,
            metadata,
            beds,
            currency,
            admissionFee: Number(metadata?.admissionFee || 0),
            securityFee: Number(metadata?.securityFee || 0),
            serviceFee: Number(metadata?.serviceFee || 0),
            amount,
            ownerName,
            ownerEmail,
            ownerPhone,
            supportEmail: process.env.ADMIN_EMAIL || "support",
          });
          await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: customerEmail,
            subject: `Booking confirmed — ${process.env.APP_NAME || "Your Booking"}`,
            html: customerHtml,
          });
          console.log("Customer email sent to", customerEmail);
        }

        // Send email to admin
        if (process.env.ADMIN_EMAIL) {
          // Redact any customer email before sending session details to admin
          const sanitizedSession = JSON.parse(JSON.stringify(session));
          if (sanitizedSession.customer_details) {
            sanitizedSession.customer_details.email = "[REDACTED]";
          }
          if (sanitizedSession.customer_email)
            sanitizedSession.customer_email = "[REDACTED]";

          // Replace IDs in metadata with resolved names and normalize quantities to avoid leaking raw IDs/Quantity
          if (
            sanitizedSession.metadata &&
            typeof sanitizedSession.metadata === "object"
          ) {
            if (roomName) sanitizedSession.metadata.roomId = roomName;
            if (hostelName) sanitizedSession.metadata.hostelId = hostelName;
            sanitizedSession.metadata.bedsBooked = String(beds);
          }
          try {
            sanitizedSession.quantity = beds;
            if (Array.isArray(sanitizedSession.line_items)) {
              sanitizedSession.line_items = sanitizedSession.line_items.map(
                (li) => ({
                  ...li,
                  quantity: beds,
                }),
              );
            }
          } catch (e) {
            // ignore normalization errors
          }

          // Simplified admin email: booking details + service/admission fee breakdown
          try {
            const serviceFee = metadata?.serviceFee ? Number(metadata.serviceFee) : 0;
            const admissionFee = metadata?.admissionFee ? Number(metadata.admissionFee) : 0;
            const serviceAdminAmt = metadata?.serviceAdmin ? Number(metadata.serviceAdmin) : 0;
            const securityFee = metadata?.securityFee ? Number(metadata.securityFee) : 0;

            const adminHtml = getAdminBookingEmail({
              hostelName: hostelName || '-',
              metadata,
              roomLabel: roomLabel || '-',
              beds,
              serviceFee,
              admissionFee,
              securityFee,
              serviceAdminAmt,
            });

            await transporter.sendMail({
              from: process.env.FROM_EMAIL || process.env.SMTP_USER,
              to: process.env.ADMIN_EMAIL,
              subject: `Booking received & service fee credited — ${process.env.APP_NAME || "App"}`,
              html: adminHtml,
            });
            console.log("Admin email sent to", process.env.ADMIN_EMAIL);
          } catch (e) {
            console.error('Failed to send simplified admin email:', e && e.message ? e.message : e);
          }
        }
        // Attempt to transfer funds to owner if this booking belongs to a hostel with an owner
        try {
          const hostelId =
            session.metadata?.hostelId || session.metadata?.hostel || null;
          const amount = session.amount_total;
          const currency = session.currency || "pkr";

          if (hostelId && amount) {
            const hostel = await Hostel.findById(hostelId).lean();
            if (hostel && hostel.ownerId) {
              const owner = await User.findById(hostel.ownerId)
                .select("stripe")
                .lean();
              const ownerAccountId = owner?.stripe?.accountId || null;

              // Retrieve PaymentIntent -> charge id to use as source_transaction for transfer
              if (ownerAccountId && session.payment_intent) {
                try {
                  const pi = await stripe.paymentIntents.retrieve(
                    session.payment_intent,
                  );
                  const charge =
                    pi && pi.charges && pi.charges.data && pi.charges.data[0];
                  if (charge && charge.id && charge.status === "succeeded") {
                    // Only create transfer if charge was not already transferred
                    if (!charge.transfer_data) {
                      await stripe.transfers.create({
                        amount: amount,
                        currency: currency,
                        destination: ownerAccountId,
                        source_transaction: charge.id,
                      });
                      console.log(
                        "Transferred",
                        amount,
                        currency,
                        "to",
                        ownerAccountId,
                      );
                    } else {
                      console.log(
                        "Charge already has transfer_data; skipping transfer",
                      );
                    }
                  }
                } catch (txErr) {
                  console.error(
                    "Owner transfer failed:",
                    txErr.message || txErr,
                  );
                }
              }
            }
          }
        } catch (ownerErr) {
          console.warn(
            "Error while attempting owner transfer:",
            ownerErr.message || ownerErr,
          );
        }

        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log("PaymentIntent was successful:", paymentIntent.id);
        break;
      }
      case "charge.succeeded": {
        const charge = event.data.object;
        console.log("Charge succeeded:", charge.id);
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (err) {
    console.error("Error handling webhook event:", err);
  }

  res.json({ received: true });
};
