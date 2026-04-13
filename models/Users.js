import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "owner", "admin"],
      default: "student",
    },

    isVerified: {
      type: Boolean,
      default: false, // owners need admin verification
    },

    quizCompleted: {
      type: Boolean,
      default: false, // tracks if student completed personality quiz
    },

    personalityScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },

    personalityVector: {
      type: [Number], // optional: normalized vector for matching
      default: [],
    },

    // Optional: store additional preferences here if needed for matching
    locationPreference: {
      type: String,
      enum: [
        "urban_lively",
        "near_campus_or_office",
        "quiet_residential",
        "flexible_location",
      ],
    },
    budgetPreference: {
      type: String,
      enum: [
        "premium_comfort",
        "balanced_quality",
        "affordable_pricing",
        "basic_essentials",
      ],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    // Stripe keys for owners (optional)
    stripe: {
      publicKey: { type: String, default: "" },
      secretKey: { type: String, default: "" },
      accountId: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
