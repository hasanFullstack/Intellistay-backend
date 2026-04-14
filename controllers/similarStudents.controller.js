import User from "../models/Users.js";
import {
  calculateCompatibilityScore,
  getStrongMatches,
  getMatchLabel,
} from "../utils/matchingEngine.js";

// Get students most similar to the logged-in student
export const getSimilarStudents = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);

    if (!currentUser.quizCompleted || !currentUser.personalityVector?.length) {
      return res.status(400).json({
        message: "Complete your personality quiz first to find similar students",
      });
    }

    // Find all other students who completed the quiz
    const otherStudents = await User.find({
      _id: { $ne: currentUser._id },
      role: "student",
      quizCompleted: true,
      personalityVector: { $exists: true, $ne: [] },
    }).select("name email personalityVector personalityScore");

    const results = otherStudents
      .map((student) => {
        // Use the weighted matching engine
        const { score, breakdown } = calculateCompatibilityScore(
          currentUser.personalityVector,
          student.personalityVector
        );

        const matchLabel = getMatchLabel(score);
        const strongMatches = getStrongMatches(breakdown);

        // Top 3 strongest matching dimensions
        const topMatches = [...breakdown]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((d) => ({ label: d.label, score: d.score }));

        return {
          student: {
            _id: student._id,
            name: student.name,
            personalityScore: student.personalityScore,
          },
          similarityScore: score,
          matchLabel,
          sharedTraits: strongMatches,
          topMatches,
        };
      })
      .filter((r) => r.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 10);

    res.status(200).json({
      count: results.length,
      currentUser: {
        name: currentUser.name,
        personalityScore: currentUser.personalityScore,
      },
      similarStudents: results,
    });
  } catch (error) {
    console.error("Error finding similar students:", error);
    res.status(500).json({ message: error.message });
  }
};
