import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Helmet — HTTP security headers (XSS, clickjacking, MIME sniffing)
export const securityHeaders = helmet();

// Rate limiter for auth routes — prevent brute-force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per window
  message: {
    message: "Too many attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiter for all API routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
