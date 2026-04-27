import express from "express";
import {
  startConnectOnboarding,
  getConnectStatus,
  createStripeDashboardLink,
  disconnectStripe,
} from "../controllers/ownerStripe.controller.js";
import { protect, ownerOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Start Stripe Connect Express onboarding — returns a hosted onboarding URL
router.post("/connect/onboard", protect, ownerOnly, startConnectOnboarding);
// Get current Connect account status
router.get("/connect/status", protect, ownerOnly, getConnectStatus);
// Open Stripe Express dashboard for the connected owner
router.post("/connect/dashboard-link", protect, ownerOnly, createStripeDashboardLink);
// Disconnect Stripe Connect account
router.delete("/connect", protect, ownerOnly, disconnectStripe);

export default router;
