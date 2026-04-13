import express from "express";
import { getStudentRecommendations } from "../controllers/recommendation.controller.js";
import { protect, studentOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, studentOnly, getStudentRecommendations);

export default router;