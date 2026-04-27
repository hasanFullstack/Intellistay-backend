import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    roomType: {
      type: String,
      enum: ["Single", "Shared", "Deluxe"],
      required: true,
    },
    totalBeds: {
      type: Number,
      required: true,
    },
    availableBeds: {
      type: Number,
      required: true,
    },
    pricePerBed: {
      type: Number,
      required: true,
    },
    // When true, owner has accepted an AI suggested price and AI should not
    // provide further live suggestions for this room unless manually reset.
    aiApplied: {
      type: Boolean,
      default: false,
    },
    images: [String],
    description: String,
    roomLabel: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

roomSchema.index({ hostelId: 1 });
roomSchema.index({ availableBeds: 1 });
roomSchema.index({ hostelId: 1, pricePerBed: 1 });
// Ensure per-hostel room numbers are unique
// NOTE: Per-hostel sequential `number` removed — use `roomLabel` or computed index instead.

export default mongoose.model("Room", roomSchema);
