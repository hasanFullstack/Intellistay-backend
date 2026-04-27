import { emailWrapper, summaryBox, divider } from "./helpers.js";

export const getAdminBookingEmail = ({
  hostelName,
  metadata = {},
  roomLabel,
  beds,
  serviceFee = 0,
  admissionFee = 0,
  securityFee = 0,
  serviceAdminAmt = 0,
}) =>
  emailWrapper({
    headerColor: "#dc2626",
    title: "New Booking Completed",
    content: `
      <p>Hi Admin,</p>
      <p>A new booking was completed.</p>

      <h3>Booking Details</h3>
      <p><strong>Hostel:</strong> ${hostelName || "-"}</p>
      <p><strong>Room:</strong> ${metadata.roomType || "-"} (${roomLabel || metadata.roomLabel || "-"})</p>
      <p><strong>Check-in:</strong> ${metadata.startDate || "-"}</p>
      <p><strong>Beds booked:</strong> ${beds || 1}</p>

      ${divider()}

      <h3>Payment Breakdown</h3>
      <p><strong>Service Fee:</strong> Rs ${serviceFee}</p>
      <p><strong>Admission Fee:</strong> Rs ${admissionFee}</p>
      <p><strong>Security Fee:</strong> Rs ${securityFee}</p>

      ${summaryBox({
        text: `Amount Credited to Platform: Rs ${serviceAdminAmt}`,
        bg: "#fef2f2",
        color: "#991b1b",
      })}
    `,
  });
