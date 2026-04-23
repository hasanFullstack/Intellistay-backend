import express from "express";
import ownerController from "../controllers/owner.controller.js";
import { protect } from "../middleware/role.middleware.js";

const router = express.Router();

// GET /api/owners/kpis - owner dashboard KPIs
router.get("/kpis", protect, ownerController.getOwnerKpis);

export default router;
