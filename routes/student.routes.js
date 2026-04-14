import express from "express";
import { getStudentRecommendations } from "../controllers/recommendation.controller.js";
import { getSimilarStudents } from "../controllers/similarStudents.controller.js";
import { protect, studentOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/students/recommendations - AI hostel recommendations
router.get("/recommendations", protect, studentOnly, getStudentRecommendations);

// GET /api/students/similar - Find similar students
router.get("/similar", protect, studentOnly, getSimilarStudents);

export default router;
