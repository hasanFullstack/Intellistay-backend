import express from "express";
import { body, validationResult } from "express-validator";
import { register, login } from "../controllers/auth.controller.js";
import { protect } from "../middleware/role.middleware.js";

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

// Register with validation + password strength
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .isIn(["student", "owner"])
      .withMessage("Role must be student or owner"),
  ],
  validate,
  register
);

// Login with validation
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  login
);

// Get current user profile (protected route)
router.get("/profile", protect, (req, res) => {
  res.json({ user: req.user });
});

export default router;
