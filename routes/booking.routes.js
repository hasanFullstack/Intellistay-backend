import express from "express";
import {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getOwnerBookings,
  acceptBooking,
  rejectBooking,
} from "../controllers/booking.controller.js";
import { protect, allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Protected routes (Students)
router.post("/", protect, allowRoles("student"), createBooking);
router.get("/my", protect, allowRoles("student"), getUserBookings);
router.get("/:id", protect, getBookingById);
router.put("/:id/cancel", protect, allowRoles("student"), cancelBooking);

// Owner routes
router.get("/owner/all", protect, allowRoles("owner"), getOwnerBookings);
router.put("/:id/accept", protect, allowRoles("owner"), acceptBooking);
router.put("/:id/reject", protect, allowRoles("owner"), rejectBooking);

export default router;
