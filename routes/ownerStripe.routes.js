import express from "express";
import {
  saveStripeKeys,
  getStripeKeys,
  deleteStripeKeys,
} from "../controllers/ownerStripe.controller.js";
import { protect, ownerOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Save/update stripe keys (owner only)
router.post("/", protect, ownerOnly, saveStripeKeys);
// Get stripe keys (masked)
router.get("/", protect, ownerOnly, getStripeKeys);
// Delete stripe keys
router.delete("/", protect, ownerOnly, deleteStripeKeys);

export default router;
