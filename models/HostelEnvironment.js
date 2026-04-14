import mongoose from "mongoose";

const hostelEnvironmentSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      unique: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    environmentProfile: {
      socialEnvironment: {
        type: String,
        enum: ["very_social", "somewhat_social", "quiet", "very_quiet"],
        default: "somewhat_social",
      },

      cleanlinessStandard: {
        type: String,
        enum: ["very_strict", "strict", "moderate", "relaxed"],
        default: "moderate",
      },

      noiseLevelDay: {
        type: String,
        enum: ["quiet", "moderate", "lively", "very_lively"],
        default: "moderate",
      },

      noiseLevelNight: {
        type: String,
        enum: ["very_quiet", "quiet", "moderate", "party_zone"],
        default: "quiet",
      },

      studyEnvironment: {
        type: Boolean,
        default: true,
      },

      amenities: [String],

      eventFrequency: {
        type: String,
        enum: ["frequent", "occasional", "rare", "none"],
        default: "occasional",
      },

      petsAllowed: {
        type: Boolean,
        default: false,
      },

      visitorPolicy: {
        type: String,
        enum: ["open", "restricted_hours", "restricted_days", "no_visitors"],
        default: "restricted_hours",
      },

      ageGroup: {
        type: String,
        enum: ["18-20", "20-22", "22-24", "mixed"],
        default: "mixed",
      },

      diverseBackground: {
        type: Boolean,
        default: true,
      },

      academicFocus: {
        type: String,
        enum: ["very_high", "high", "moderate", "low"],
        default: "moderate",
      },

      maintenanceQuality: {
        type: String,
        enum: ["excellent", "good", "average", "poor"],
        default: "good",
      },

      budgetTier: {
        type: String,
        enum: ["luxury", "premium", "mid_range", "budget"],
        default: "mid_range",
      },

      nearbyNature: {
        type: Boolean,
        default: false,
      },
    },

    // 🔥 Matching Vector
    hostelVector: {
      type: [Number],
      default: [],
    },

    environmentScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("HostelEnvironment", hostelEnvironmentSchema);