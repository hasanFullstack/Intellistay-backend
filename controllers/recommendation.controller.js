import User from "../models/Users.js";
import HostelEnvironment from "../models/HostelEnvironment.js";
import {
  calculateCompatibilityScore,
  getStrongMatches,
  getWeakMatches,
  checkBudgetAlignment,
  getMatchLabel,
} from "../utils/matchingEngine.js";

// Get student recommendations with rich breakdown
export const getStudentRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.quizCompleted || !user.personalityVector?.length) {
      return res.status(400).json({
        message: "Complete personality quiz first",
      });
    }

    const environments = await HostelEnvironment.find({
      profileCompleted: true,
    }).populate({
      path: "hostelId",
      populate: { path: "ownerId", select: "name" },
    });

    const recommendations = environments
      .filter((env) => env.hostelId)
      .map((env) => {
        const hostelVector = env.hostelVector || [];

        // Use the new weighted matching engine
        const { score: personalityMatch, breakdown } = calculateCompatibilityScore(
          user.personalityVector,
          hostelVector
        );

        // Budget alignment
        const budgetResult = checkBudgetAlignment(
          user.budgetPreference,
          env.environmentProfile?.budgetTier
        );

        const totalScore = Math.min(100, personalityMatch + budgetResult.bonus);
        const matchLabel = getMatchLabel(totalScore);

        // Strong & weak dimensions
        const strongMatches = getStrongMatches(breakdown);
        const weakMatches = getWeakMatches(breakdown);

        // Top 3 scoring dimensions for summary
        const topDimensions = [...breakdown]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((d) => ({ label: d.label, score: d.score }));

        return {
          hostel: {
            _id: env.hostelId._id,
            name: env.hostelId.name,
            gender: env.hostelId.gender,
            addressLine1: env.hostelId.addressLine1,
            addressLine2: env.hostelId.addressLine2,
            city: env.hostelId.city,
            amenities: env.hostelId.amenities,
            images: env.hostelId.images,
            owner: env.hostelId.ownerId?.name || "Unknown",
          },
          compatibilityScore: totalScore,
          matchLabel,
          breakdown: {
            personalityMatch,
            budgetMatch: budgetResult.bonus,
            budgetAligned: budgetResult.aligned,
            strongMatches,
            weakMatches,
            topDimensions,
            fullBreakdown: breakdown,
          },
          environmentProfile: {
            socialEnvironment: env.environmentProfile?.socialEnvironment,
            cleanlinessStandard: env.environmentProfile?.cleanlinessStandard,
            studyEnvironment: env.environmentProfile?.studyEnvironment,
            budgetTier: env.environmentProfile?.budgetTier,
            noiseLevelNight: env.environmentProfile?.noiseLevelNight,
          },
        };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 10);

    res.status(200).json({
      count: recommendations.length,
      userProfile: {
        name: user.name,
        personalityScore: user.personalityScore,
        budgetPreference: user.budgetPreference,
      },
      recommendations,
    });
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({ message: error.message });
  }
};