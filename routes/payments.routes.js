import express from "express";
import {
  createCheckoutSession,
  sendTestEmail,
} from "../controllers/payments.controller.js";

const router = express.Router();

router.get("/test-email", sendTestEmail);
router.post("/test-email", sendTestEmail);
router.post("/create-checkout-session", createCheckoutSession);

export default router;
