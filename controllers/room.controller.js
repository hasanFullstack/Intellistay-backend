import Room from "../models/Room.js";
import Hostel from "../models/Hostel.js";
import Booking from "../models/Booking.js";
import User from "../models/Users.js";
import mongoose from "mongoose";
import { getSuggestedPrice } from "../services/pricing.service.js";
import {
  calculateCompatibilityScore,
  getMatchLabel,
  getStrongMatches,
} from "../utils/matchingEngine.js";

export const addRoom = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { roomType, totalBeds, pricePerBed, images, description } =
      req.body;

    // Verify hostel exists and belongs to user
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ msg: "Hostel not found" });
    }
    if (String(hostel.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    const room = await Room.create({
      hostelId,
      roomType,
      totalBeds,
      availableBeds: totalBeds,
      pricePerBed,
      images: images || [],
      description: description || "",
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getRoomsByHostel = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const rooms = await Room.find({ hostelId }).select({ images: { $slice: 1 }, roomType: 1, totalBeds: 1, availableBeds: 1, pricePerBed: 1, description: 1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getAllRooms = async (req, res) => {
  try {
    const hasAdvancedFilters = [
      "page",
      "hostelId",
      "search",
      "minPrice",
      "maxPrice",
      "minBeds",
      "maxBeds",
      "gender",
      "amenities",
      "roommateMode",
      "availableOnly",
    ].some((key) => Object.prototype.hasOwnProperty.call(req.query, key));

    // Backward-compatible response for existing consumers (array)
    if (!hasAdvancedFilters) {
      const limit = parseInt(req.query.limit, 10) || 0;
      let query = Room.find(
        {},
        {
          images: { $slice: 1 },
          roomType: 1,
          totalBeds: 1,
          availableBeds: 1,
          pricePerBed: 1,
          description: 1,
          hostelId: 1,
        },
      )
        .sort({ createdAt: -1 })
        .populate("hostelId", "name city addressLine1 addressLine2 city gender amenities");
      if (limit > 0) query = query.limit(limit);
      const rooms = await query.lean();
      return res.json(rooms);
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 48);

    const search = (req.query.search || "").trim();
    const hostelId = (req.query.hostelId || "").trim();
    const gender = (req.query.gender || "all").trim();
    const roommateMode = (req.query.roommateMode || "all").trim();
    const availableOnly = String(req.query.availableOnly || "true") === "true";

    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    const minBeds = Number(req.query.minBeds);
    const maxBeds = Number(req.query.maxBeds);

    const amenities = String(req.query.amenities || "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const match = {};

    if (hostelId) {
      if (!mongoose.Types.ObjectId.isValid(hostelId)) {
        return res.status(400).json({ msg: "Invalid hostelId" });
      }
      match.hostelId = new mongoose.Types.ObjectId(hostelId);
    }

    if (availableOnly) {
      match.availableBeds = { $gt: 0 };
    }

    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      match.pricePerBed = {};
      if (Number.isFinite(minPrice)) match.pricePerBed.$gte = minPrice;
      if (Number.isFinite(maxPrice)) match.pricePerBed.$lte = maxPrice;
    }

    if (Number.isFinite(minBeds) || Number.isFinite(maxBeds)) {
      match.totalBeds = {};
      if (Number.isFinite(minBeds)) match.totalBeds.$gte = minBeds;
      if (Number.isFinite(maxBeds)) match.totalBeds.$lte = maxBeds;
    }

    if (roommateMode === "shared-only") {
      match.roomType = { $ne: "Single" };
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "hostels",
          localField: "hostelId",
          foreignField: "_id",
          as: "hostel",
        },
      },
      { $unwind: "$hostel" },
    ];

    const joinedMatch = {};

    if (gender && gender.toLowerCase() !== "all") {
      joinedMatch["hostel.gender"] = { $regex: `^${gender}$`, $options: "i" };
    }

    if (amenities.length > 0) {
      joinedMatch["hostel.amenities"] = { $all: amenities };
    }

    if (search) {
      joinedMatch.$or = [
        { roomType: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "hostel.name": { $regex: search, $options: "i" } },
        { "hostel.city": { $regex: search, $options: "i" } },
        { "hostel.addressLine1": { $regex: search, $options: "i" } },
      ];
    }

    if (Object.keys(joinedMatch).length > 0) {
      pipeline.push({ $match: joinedMatch });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $project: {
          roomType: 1,
          totalBeds: 1,
          availableBeds: 1,
          pricePerBed: 1,
          description: 1,
          images: { $slice: ["$images", 1] },
          hostelId: {
            _id: "$hostel._id",
            name: "$hostel.name",
            city: "$hostel.city",
            addressLine1: "$hostel.addressLine1",
            addressLine2: "$hostel.addressLine2",
            gender: "$hostel.gender",
            amenities: "$hostel.amenities",
          },
          createdAt: 1,
        },
      },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    );

    const result = await Room.aggregate(pipeline);
    const data = result?.[0]?.data || [];
    const total = result?.[0]?.totalCount?.[0]?.count || 0;

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId).populate("hostelId").lean();
    if (!room) {
      return res.status(404).json({ msg: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const updateRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ msg: "Room not found" });
    }

    const hostel = await Hostel.findById(room.hostelId);
    if (String(hostel.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    const updatedRoom = await Room.findByIdAndUpdate(roomId, req.body, {
      new: true,
    });

    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ msg: "Room not found" });
    }

    const hostel = await Hostel.findById(room.hostelId);
    if (String(hostel.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await Room.findByIdAndDelete(roomId);
    res.json({ msg: "Room deleted successfully" });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getRoomSuggestedPrice = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ msg: "Room not found" });

    const hostel = await Hostel.findById(room.hostelId);

    // Ensure only the owner can request the price
    if (String(hostel.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    const result = await getSuggestedPrice(room, hostel);
    res.json(result);
  } catch (err) {
    res.status(500).json({ msg: "AI service unavailable: " + err.message });
  }
};

// Get current occupants (confirmed bookings) for a room and compatibility
export const getRoomOccupants = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ msg: "Room not found" });

    const today = new Date();

    // Find confirmed bookings that haven't ended yet
    const bookings = await Booking.find({
      roomId,
      status: "confirmed",
      endDate: { $gte: today },
    }).populate("userId", "name personalityVector personalityScore");

    if (!bookings || bookings.length === 0) {
      return res.json({
        count: 0,
        occupants: [],
        summary: {
          totalOccupiedBeds: 0,
          visibleOccupiedBeds: 0,
          profiledOccupiedBeds: 0,
          unprofiledOccupiedBeds: 0,
        },
      });
    }

    // Current viewer (must be authenticated via protect middleware)
    const currentUser = await User.findById(req.user.id).select(
      "personalityVector personalityScore name",
    );

    const totalOccupiedBeds = bookings.reduce(
      (sum, b) => sum + Math.max(Number(b.bedsBooked || 0), 0),
      0,
    );

    const visibleBookings = bookings.filter(
      (b) => String(b.userId?._id) !== String(req.user.id),
    );

    const visibleOccupiedBeds = visibleBookings.reduce(
      (sum, b) => sum + Math.max(Number(b.bedsBooked || 0), 0),
      0,
    );

    // Merge bookings by student so one student appears once with aggregated beds
    const byStudent = new Map();
    for (const b of visibleBookings) {
      const u = b.userId;
      if (!u?._id) continue;
      const key = String(u._id);
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          _id: u._id,
          name: u.name,
          personalityScore: u.personalityScore,
          personalityVector: u.personalityVector || [],
          bedsBooked: 0,
          bedNumbers: [],
        });
      }
      const normalizedBedsBooked = Math.max(Number(b.bedsBooked || 0), 0);
      byStudent.get(key).bedsBooked += normalizedBedsBooked;

      const incomingBedNumbers = Array.isArray(b.bedNumbers)
        ? b.bedNumbers.filter((n) => Number.isInteger(n))
        : [];
      if (incomingBedNumbers.length > 0) {
        byStudent.get(key).bedNumbers.push(...incomingBedNumbers);
      }
    }

    const currentVector = currentUser?.personalityVector || [];
    const occupants = [];
    let profiledOccupiedBeds = 0;

    for (const s of byStudent.values()) {
      const occupant = {
        _id: s._id,
        name: s.name,
        personalityScore: s.personalityScore,
        bedsBooked: s.bedsBooked,
        bedNumbers: Array.from(new Set(s.bedNumbers)).sort((a, b) => a - b),
      };

      if (currentVector.length > 0 && s.personalityVector?.length > 0) {
        const { score, breakdown } = calculateCompatibilityScore(
          currentVector,
          s.personalityVector,
        );
        occupant.similarityScore = score;
        occupant.matchLabel = getMatchLabel(score);
        occupant.sharedTraits = getStrongMatches(breakdown);
        occupant.topMatches = [...breakdown]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((d) => ({ label: d.label, score: d.score }));
        profiledOccupiedBeds += s.bedsBooked;
      }

      occupants.push(occupant);
    }

    const unprofiledOccupiedBeds = Math.max(
      visibleOccupiedBeds - profiledOccupiedBeds,
      0,
    );

    res.json({
      count: occupants.length,
      occupants,
      summary: {
        totalOccupiedBeds,
        visibleOccupiedBeds,
        profiledOccupiedBeds,
        unprofiledOccupiedBeds,
      },
    });
  } catch (error) {
    console.error("Error getting room occupants:", error);
    res.status(500).json({ msg: error.message });
  }
};
