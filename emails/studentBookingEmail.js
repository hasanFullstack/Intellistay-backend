import { emailWrapper, summaryBox, divider } from "./helpers.js";

export const getStudentBookingEmail = ({
  hostelName,
  roomLabel,
  metadata = {},
  beds,
  currency = "pkr",
  admissionFee = 0,
  securityFee = 0,
  serviceFee = 0,
  amount,
  ownerName = "-",
  ownerEmail = "-",
  ownerPhone = "-",
  supportEmail = "support",
}) =>
  emailWrapper({
    headerColor: "#4f46e5",
    title: "Booking Confirmed ✓",
    content: `
      <p>Thank you for your payment. Your booking has been successfully confirmed.</p>

      <h3>Booking Details</h3>
      <p><strong>Hostel:</strong> ${hostelName || "-"}</p>
      <p><strong>Room Number:</strong> ${roomLabel || "-"}</p>
      <p><strong>Room Type:</strong> ${metadata.roomType || "-"}</p>
      <p><strong>Number of Beds:</strong> ${beds || 1}</p>
      <p><strong>Price per Bed:</strong> ${metadata.pricePerBed || "-"} ${String(currency).toUpperCase()}</p>
      <p><strong>Check-in Date:</strong> ${metadata.startDate || "-"}</p>

      ${divider()}

      <h3>Payment Summary</h3>
      <p><strong>Admission Fee:</strong> Rs ${admissionFee}</p>
      <p><strong>Security Fee:</strong> Rs ${securityFee}</p>
      <p><strong>Service Charges:</strong> Rs ${serviceFee}</p>

      ${summaryBox({
        text: `Total Amount Paid: ${
          amount ? (amount / 100).toFixed(2) + " " + String(currency).toUpperCase() : "-"
        }`,
      })}

      <h4>Hostel Owner Contact</h4>
      <p><strong>Name:</strong> ${ownerName}</p>
      <p><strong>Email:</strong> ${ownerEmail}</p>
      <p><strong>Phone:</strong> ${ownerPhone}</p>
      <p style="margin-top: 10px; color: #666;">If you have any other questions about your booking, please contact us at ${supportEmail}.</p>
    `,
  });
