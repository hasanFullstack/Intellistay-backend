import { emailWrapper, summaryBox, divider } from "./helpers.js";

export const getOwnerBookingEmail = ({
  ownerUser = {},
  ownerHostel = {},
  metadata = {},
  roomLabel,
  bedsBooked,
  serviceFee = 0,
  admissionFee = 0,
  securityFee = 0,
  admissionOwnerAmt = 0,
  customerName,
  customerEmail,
}) =>
  emailWrapper({
    headerColor: "#059669",
    title: "New Booking Received",
    content: `
      <p>Hi ${ownerUser.name || "Hostel Owner"},</p>
      <p>A new booking was completed for your hostel.</p>

      <h3>Booking Details</h3>
      <p><strong>Hostel:</strong> ${ownerHostel.name || "-"}</p>
      <p><strong>Room:</strong> ${metadata.roomType || "-"} (${roomLabel || metadata.roomLabel || "-"})</p>
      <p><strong>Check-in:</strong> ${metadata.startDate || "-"}</p>
      <p><strong>Beds booked:</strong> ${bedsBooked || 1}</p>
      ${customerName ? `<p><strong>Customer name:</strong> ${customerName}</p>` : ""}
      ${customerEmail ? `<p><strong>Customer email:</strong> ${customerEmail}</p>` : ""}

      ${divider()}

      <h3>Payment Breakdown</h3>
      <p><strong>Service Fee:</strong> Rs ${serviceFee}</p>
      <p><strong>Admission Fee:</strong> Rs ${admissionFee}</p>
      <p><strong>Security Fee:</strong> Rs ${securityFee}</p>

      ${summaryBox({
        text: `Amount Credited to You: Rs ${admissionOwnerAmt}`,
        bg: "#ecfdf5",
        color: "#065f46",
      })}
      <p style="margin-top:8px; color:#666;">This amount has been added to your account balance.</p>
    `,
  });
