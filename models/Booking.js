import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    // Per-hostel room number snapshot at booking time
    roomNumber: {
      type: Number,
      required: false,
    },
    startDate: {
      type: Date,
      required: true,
    },
    bedsBooked: {
      type: Number,
      required: true,
      min: 1,
    },
    bedNumbers: {
      type: [Number],
      default: [],
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    // Optional one-time admission fee paid by student (in currency units, e.g., PKR)
    admissionFee: {
      type: Number,
      default: 0,
    },
    // How the admission fee was split: admin and owner amounts (currency units)
    admissionSplit: {
      admin: { type: Number, default: 0 },
      owner: { type: Number, default: 0 },
    },
    // Optional service fee collected for platform (e.g., convenience/service charge)
    serviceFee: {
      type: Number,
      default: 0,
    },
    // How the service fee was split (usually to platform/admin)
    serviceSplit: {
      admin: { type: Number, default: 0 },
    },
    // Optional refundable security fee (usually equals per-bed fee x booked beds)
    securityFee: {
      type: Number,
      default: 0,
    },
    securityFeeStatus: {
      type: String,
      enum: ["not_applicable", "held", "refunded"],
      default: "not_applicable",
    },
    securityFeeRefundedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "confirmed",
    },
    stripeSessionId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

bookingSchema.index({ roomId: 1, status: 1, startDate: 1 });
// Sparse unique index: prevents duplicate bookings for the same Stripe session
bookingSchema.index({ stripeSessionId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Booking", bookingSchema);
