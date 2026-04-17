import Stripe from "stripe";
import nodemailer from "nodemailer";
import Hostel from "../models/Hostel.js";
import User from "../models/Users.js";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";

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
          console.log("Metadata received:", { roomId, hostelId, userId, startDate, bedsBooked });
          
          if (roomId && hostelId && userId && startDate) {
            // Idempotency check — skip if this session already created a booking
            const existing = await Booking.findOne({ stripeSessionId: session.id });
            if (existing) {
              console.log("Booking already exists for session", session.id, "— skipping duplicate");
            } else {
              const booking = await Booking.create({
                userId,
                hostelId,
                roomId,
                startDate: new Date(startDate),
                bedsBooked: parseInt(bedsBooked || 1, 10),
                totalPrice: amount / 100,
                status: "confirmed",
                stripeSessionId: session.id,
              });
              
              await Room.findByIdAndUpdate(
                roomId,
                { $inc: { availableBeds: -parseInt(bedsBooked || 1, 10) } },
                { new: true }
              );
              
              console.log("Booking created via webhook:", booking._id);
            }
          } else {
            console.warn("Webhook: missing metadata fields — booking not created.", metadata);
          }
        } catch (bookingErr) {
          console.error("Failed to create booking record:", bookingErr.message || bookingErr);
        }

        // Build email content
        const roomDetailsHtml = `
          <h3>Booking Details</h3>
          <p><strong>Room:</strong> ${metadata.roomId || "-"}</p>
          <p><strong>Hostel:</strong> ${metadata.hostelId || "-"}</p>
          <p><strong>Type:</strong> ${metadata.roomType || "-"}</p>
          <p><strong>Price per bed:</strong> ${metadata.pricePerBed || "-"} ${currency.toUpperCase()}</p>
          <p><strong>Quantity:</strong> ${session.quantity || 1}</p>
          <p><strong>Total:</strong> ${amount ? (amount / 100).toFixed(2) + " " + currency.toUpperCase() : "-"}</p>
        `;

        // Send email to customer
        if (customerEmail) {
          await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: customerEmail,
            subject: `Booking confirmed — ${process.env.APP_NAME || "Your Booking"}`,
            html: `
              <p>Thank you for your payment. Your booking is confirmed.</p>
              ${roomDetailsHtml}
            `,
          });
          console.log("Customer email sent to", customerEmail);
        }

        // Send email to admin
        if (process.env.ADMIN_EMAIL) {
          await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `New booking received — ${process.env.APP_NAME || "App"}`,
            html: `
              <p>New booking completed via Stripe.</p>
              <p><strong>Session ID:</strong> ${session.id}</p>
              ${roomDetailsHtml}
              <pre>${JSON.stringify(session, null, 2)}</pre>
            `,
          });
          console.log("Admin email sent to", process.env.ADMIN_EMAIL);
        }

        // Send email to hostel owner
        try {
          const ownerHostelId = metadata.hostelId || metadata.hostel || null;
          if (ownerHostelId) {
            const ownerHostel = await Hostel.findById(ownerHostelId).lean();
            if (ownerHostel && ownerHostel.ownerId) {
              const ownerUser = await User.findById(ownerHostel.ownerId)
                .select("email name")
                .lean();

              if (ownerUser?.email) {
                await transporter.sendMail({
                  from: process.env.FROM_EMAIL || process.env.SMTP_USER,
                  to: ownerUser.email,
                  subject: `New booking received — ${process.env.APP_NAME || "Intellistay"}`,
                  html: `
                    <p>Hi ${ownerUser.name || "Hostel Owner"},</p>
                    <p>You have received a new booking for your hostel.</p>
                    <p><strong>Hostel:</strong> ${ownerHostel.name || metadata.hostelId || "-"}</p>
                    <p><strong>Room type:</strong> ${metadata.roomType || "-"}</p>
                    <p><strong>Beds booked:</strong> ${metadata.bedsBooked || 1}</p>
                    <p><strong>Check-in date:</strong> ${metadata.startDate || "-"}</p>
                    <p><strong>Total:</strong> ${amount ? (amount / 100).toFixed(2) + " " + currency.toUpperCase() : "-"}</p>
                    <p><strong>Stripe session:</strong> ${session.id}</p>
                  `,
                });
                console.log("Hostel owner email sent to", ownerUser.email);
              }
            }
          }
        } catch (ownerEmailErr) {
          console.error(
            "Failed to send hostel owner email:",
            ownerEmailErr.message || ownerEmailErr,
          );
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
