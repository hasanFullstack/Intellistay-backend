import express from "express";
import {
  submitPersonalityQuiz,
  getPersonalityQuiz,
  checkQuizCompletion,
  getAllPersonalityQuizzes
} from "../controllers/personality.controller.js";
import { protect, allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Submit or update personality quiz (students only)
router.post("/submit", protect, allowRoles("student"), submitPersonalityQuiz);

// Get personality quiz for a specific user (students/admin can see)
router.get("/:userId", protect, allowRoles("student", "admin"), getPersonalityQuiz);

// Check if user has completed personality quiz
router.get("/check/:userId", protect, allowRoles("student", "admin"), checkQuizCompletion);

// Get all personality quizzes (admin only)
router.get("/", protect, allowRoles("admin"), getAllPersonalityQuizzes);

export default router;