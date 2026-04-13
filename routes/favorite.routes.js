import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  addFavorite,
  removeFavorite,
  getUserFavorites,
  isFavorited,
  checkFavorites,
  syncFavorites,
} from "../controllers/favorite.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Add favorite
router.post("/", addFavorite);

// Remove favorite
router.delete("/:hostelId", removeFavorite);

// Get user's favorites
router.get("/", getUserFavorites);

// Check if single hostel is favorited
router.get("/check/:hostelId", isFavorited);

// Check multiple hostels
router.post("/check-multiple", checkFavorites);

// Sync cached favorites on login
router.post("/sync", syncFavorites);

export default router;
