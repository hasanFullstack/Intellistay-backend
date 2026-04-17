import express from "express";
import {
  createCheckoutSession,
  sendTestEmail,
  finalizeBooking,
  getBookingBySession,
} from "../controllers/payments.controller.js";
import { protect } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/test-email", sendTestEmail);
router.post("/test-email", sendTestEmail);
router.post("/create-checkout-session", protect, createCheckoutSession);
router.post("/finalize-booking", protect, finalizeBooking);
router.get("/booking-by-session/:sessionId", protect, getBookingBySession);

export default router;
