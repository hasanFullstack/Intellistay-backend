import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import dns from "dns";

import authRoutes from "./routes/auth.routes.js";
import hostelRoutes from "./routes/hostel.routes.js";
import roomRoutes from "./routes/room.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import personalityRoutes from "./routes/personality.routes.js";
import hostelEnvironmentRoutes from "./routes/hostelEnvironment.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import studentRoutes from "./routes/student.routes.js";
import stripeRoutes from "./routes/stripe.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import ownerStripeRoutes from "./routes/ownerStripe.routes.js";

import {
  securityHeaders,
  authLimiter,
  apiLimiter,
} from "./middleware/security.middleware.js";
import errorHandler from "./middleware/errorHandler.js";
let server;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve env file path deterministically.
// - local default: <backend-root>/.env
// - deployed override: set ENV_FILE_PATH=/absolute/path/to/.env
const resolvedEnvPath = process.env.ENV_FILE_PATH
  ? path.resolve(process.env.ENV_FILE_PATH)
  : path.resolve(__dirname, ".env");

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config({ path: resolvedEnvPath });

if (process.env.NODE_ENV !== "production") {
  console.log(`Using env file: ${resolvedEnvPath}`);
}

connectDB();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://intellistay-frontend-5m9p.vercel.app",
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, "");
  const isKnownOrigin = allowedOrigins.includes(normalizedOrigin);
  const isIntellistayVercel =
    /^https:\/\/intellistay-frontend(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(
      normalizedOrigin,
    );

  return isKnownOrigin || isIntellistayVercel;
};

// Security middleware
app.use(securityHeaders);
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
// Mount Stripe webhook route BEFORE JSON body parsing so we can get the raw body for signature verification
app.use("/webhook", express.raw({ type: "application/json" }), stripeRoutes);
app.use(express.json({ limit: "10mb" }));

// Global rate limiter
app.use("/api", apiLimiter);

// Routes (auth has its own stricter rate limiter)
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/hostels", hostelRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/personality", personalityRoutes);
app.use("/api/hostel-environment", hostelEnvironmentRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/owners/stripe", ownerStripeRoutes);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`),
);
