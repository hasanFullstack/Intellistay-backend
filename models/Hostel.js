import mongoose from "mongoose";

const hostelSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    addressLine1: {
      type: String,
      required: true,
    },
    addressLine2: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      required: true,
    },
    description: String,
    amenities: [String],
    images: [String],
    rules: String,
    viewCount: {
      type: Number,
      default: 0,
    },
    environmentScore: {
      type: Number,
      default: 50,
    },
    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
      default: "Male",
    },
  },
  { timestamps: true },
);

hostelSchema.index({ ownerId: 1 });
hostelSchema.index({ viewCount: -1 });
hostelSchema.index({ createdAt: -1 });

export default mongoose.model("Hostel", hostelSchema);
