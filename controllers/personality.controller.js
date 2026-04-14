import User from "../models/Users.js";
import PersonalityQuiz from "../models/PersonalityQuiz.js";
import { calculateBehavioralVector } from "../services/personality.service.js";

// Submit or update personality quiz (uses req.user from protect middleware)
export const submitPersonalityQuiz = async (req, res) => {
  try {
    const { responses } = req.body;
    const userId = req.user._id;

    if (!responses || Object.keys(responses).length === 0) {
      return res.status(400).json({ message: "Responses are required" });
    }

    // Validate that all 14 questions are answered
    const requiredFields = [
      'eveningRoutine', 'weekendStyle', 'sharedSpaceReaction', 'noiseDuringFocus',
      'sleepPattern', 'guestComfort', 'conflictApproach', 'dailyRoutine',
      'focusEnvironment', 'sharedRoomComfort', 'locationPreference', 'budgetPriority',
      'facilityInterest', 'petPreference'
    ];

    const unanswered = requiredFields.filter(field => !responses[field]);
    if (unanswered.length > 0) {
      return res.status(400).json({ 
        message: `Missing responses for: ${unanswered.join(', ')}` 
      });
    }

    // Calculate personality vector from responses
    const { vector, budgetPreference } = calculateBehavioralVector(responses);
    
    if (!vector || vector.length === 0) {
      return res.status(400).json({ message: "Failed to calculate personality vector" });
    }

    const personalityScore = Math.round((vector.reduce((a, b) => a + b, 0) / vector.length + 2) * (100 / 4));

    // Find or create PersonalityQuiz record
    let quiz = await PersonalityQuiz.findOne({ userId });
    
    if (quiz) {
      // Update existing quiz
      quiz.responses = responses;
      quiz.personalityVector = vector;
      quiz.personalityScore = personalityScore;
      quiz.profileCompleted = true;
    } else {
      // Create new quiz
      quiz = new PersonalityQuiz({
        userId,
        email: req.user.email,
        responses,
        personalityVector: vector,
        personalityScore,
        profileCompleted: true,
      });
    }

    await quiz.save();

    // Update User model
    const user = await User.findByIdAndUpdate(
      userId,
      {
        quizCompleted: true,
        personalityVector: vector,
        personalityScore,
        budgetPreference,
      },
      { new: true }
    ).select("-password");

    res.status(201).json({
      message: "Personality quiz submitted successfully",
      user,
      quiz,
    });
  } catch (error) {
    console.error("Submit quiz error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get user's personality quiz (by userId param)
export const getPersonalityQuiz = async (req, res) => {
  try {
    const { userId } = req.params;

    const quiz = await PersonalityQuiz.findOne({ userId }).populate("userId", "name email role");
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found for this user" });
    }

    res.status(200).json({
      quiz,
      personalityVector: quiz.personalityVector,
      personalityScore: quiz.personalityScore,
      responses: quiz.responses,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Check if user has completed quiz
export const checkQuizCompletion = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("quizCompleted personalityVector personalityScore");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      quizCompleted: user.quizCompleted,
      personalityVector: user.personalityVector,
      personalityScore: user.personalityScore,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all personality quizzes (admin only)
export const getAllPersonalityQuizzes = async (req, res) => {
  try {
    const quizzes = await PersonalityQuiz.find().populate("userId", "name email role").sort({ createdAt: -1 });

    res.status(200).json({
      count: quizzes.length,
      quizzes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};