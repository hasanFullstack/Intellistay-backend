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
