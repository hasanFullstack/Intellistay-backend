import express from "express";
import {
  addHostel,
  getAllHostels,
  getHostelById,
  getOwnerHostels,
  updateHostel,
  deleteHostel,
} from "../controllers/hostel.controller.js";
import { protect, allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllHostels);

// Protected routes (Owner only)
router.post("/", protect, allowRoles("owner"), addHostel);
router.get("/my", protect, allowRoles("owner"), getOwnerHostels);

// Public route for specific hostel (keep after /my to avoid route capture)
router.get("/:id", getHostelById);

router.put("/:id", protect, allowRoles("owner"), updateHostel);
router.delete("/:id", protect, allowRoles("owner"), deleteHostel);

export default router;
