import express from "express";
import {
  addRoom,
  getRoomsByHostel,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomSuggestedPrice,
  getRoomOccupants,
} from "../controllers/room.controller.js";
import { protect, allowRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllRooms);
router.get("/hostel/:hostelId", getRoomsByHostel);
// Return current occupants for a room (requires auth)
router.get("/:roomId/occupants", protect, getRoomOccupants);

router.get("/:roomId", getRoomById);

// Protected routes (Owner only)
router.post("/hostel/:hostelId", protect, allowRoles("owner"), addRoom);
router.put("/:roomId", protect, allowRoles("owner"), updateRoom);
router.delete("/:roomId", protect, allowRoles("owner"), deleteRoom);
router.get("/:id/suggested-price", protect, allowRoles("owner"), getRoomSuggestedPrice);

export default router;
