import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

// Ensure one favorite per user-hostel pair
favoriteSchema.index({ userId: 1, hostelId: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
