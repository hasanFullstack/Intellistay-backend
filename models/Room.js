import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    // Per-hostel sequential room number (1,2,3...) assigned on create
    number: {
      type: Number,
      required: false,
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
    images: [String],
    description: String,
  },
  { timestamps: true },
);

roomSchema.index({ hostelId: 1 });
roomSchema.index({ availableBeds: 1 });
roomSchema.index({ hostelId: 1, pricePerBed: 1 });
// Ensure per-hostel room numbers are unique
roomSchema.index({ hostelId: 1, number: 1 }, { unique: true, sparse: true });

export default mongoose.model("Room", roomSchema);
