import mongoose from "mongoose";

const personalityQuizSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    email: String,
    responses: {
      eveningRoutine: { type: String },
      weekendStyle: { type: String },
      sharedSpaceReaction: { type: String },
      noiseDuringFocus: { type: String },
      sleepPattern: { type: String },
      guestComfort: { type: String },
      conflictApproach: { type: String },
      dailyRoutine: { type: String },
      focusEnvironment: { type: String },
      sharedRoomComfort: { type: String },
      locationPreference: {
        type: String,
        enum: [
          "urban_lively",
          "near_campus_or_office",
          "quiet_residential",
          "flexible_location",
        ],
      },
      budgetPriority: {
        type: String,
        enum: [
          "premium_comfort",
          "balanced_quality",
          "affordable_pricing",
          "basic_essentials",
        ],
      },
      facilityInterest: {
        type: String,
        enum: [
          "fitness_facilities",
          "entertainment_space",
          "quiet_study_space",
          "minimal_needs",
        ],
      },
      petPreference: {
        type: String,
        enum: [
          "love_pets",
          "okay_with_pets",
          "neutral_about_pets",
          "prefer_no_pets",
        ],
      },
    },
    personalityScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    personalityVector: {
      type: [Number], // optional: store normalized vector for ML/matching
      default: [],
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PersonalityQuiz", personalityQuizSchema);