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
    images: [String],
    description: String,
  },
  { timestamps: true },
);

roomSchema.index({ hostelId: 1 });
roomSchema.index({ availableBeds: 1 });
roomSchema.index({ hostelId: 1, pricePerBed: 1 });

export default mongoose.model("Room", roomSchema);
