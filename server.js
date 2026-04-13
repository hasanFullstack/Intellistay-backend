import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();
connectDB();

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ],
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
