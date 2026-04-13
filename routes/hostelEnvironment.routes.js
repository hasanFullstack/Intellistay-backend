import express from "express";
import {
  submitHostelEnvironment,
  getHostelEnvironment,
  checkEnvironmentCompletion,
  getAllHostelEnvironments,
} from "../controllers/hostelEnvironment.controller.js";

import { protect, ownerOnly, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/submit", protect, ownerOnly, submitHostelEnvironment);
router.get("/:hostelId", getHostelEnvironment);
router.get("/check/:hostelId", checkEnvironmentCompletion);
router.get("/", protect, adminOnly, getAllHostelEnvironments);

export default router;