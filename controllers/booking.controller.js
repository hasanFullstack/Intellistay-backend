import Hostel from "../models/Hostel.js";
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";

const getActiveRoomBookings = async (roomId, excludeBookingId = null) => {
  const query = {
    roomId,
    status: "confirmed",
    endDate: { $gte: new Date() },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return Booking.find(query).select("bedNumbers bedsBooked").lean();
};

const extractOccupiedBeds = (bookings) => {
  const occupied = new Set();
  for (const b of bookings) {
    if (Array.isArray(b.bedNumbers) && b.bedNumbers.length > 0) {
      for (const n of b.bedNumbers) {
        if (Number.isInteger(n)) occupied.add(n);
      }
    }
  }
  return occupied;
};

const allocateBedNumbers = (totalBeds, occupiedSet, requiredBeds) => {
  const result = [];
  for (let i = 1; i <= Number(totalBeds || 0); i += 1) {
    if (!occupiedSet.has(i)) result.push(i);
    if (result.length === requiredBeds) break;
  }
  return result;
};

export const createBooking = async (req, res) => {
  try {
    const { hostelId, roomId, startDate, endDate, bedsBooked } = req.body;

    // Verify hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ msg: "Hostel not found" });
    }

    // Verify room exists and belongs to this hostel
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: "Room not found" });
    }

    if (String(room.hostelId) !== String(hostelId)) {
      return res
        .status(400)
        .json({ msg: "Room does not belong to this hostel" });
    }

    // Check availability
    if (room.availableBeds < bedsBooked) {
      return res.status(400).json({ msg: "Not enough available beds" });
    }

    // Calculate real available slots from active confirmed bookings
    const activeBookings = await getActiveRoomBookings(roomId);
    const occupiedSet = extractOccupiedBeds(activeBookings);
    const assignedBeds = allocateBedNumbers(
      room.totalBeds,
      occupiedSet,
      Number(bedsBooked),
    );

    if (assignedBeds.length !== Number(bedsBooked)) {
      return res.status(400).json({ msg: "Not enough available beds" });
    }

    // Calculate total price
    const totalPrice = room.pricePerBed * bedsBooked;

    // Create booking
    const booking = await Booking.create({
      userId: req.user.id,
      hostelId,
      roomId,
      startDate,
      endDate,
      bedsBooked,
      bedNumbers: assignedBeds,
      totalPrice,
      status: "confirmed",
    });

    // Update room availability
    room.availableBeds -= bedsBooked;
    await room.save();

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate("hostelId", "name addressLine1 addressLine2 city gender")
      .populate("roomId", "roomType pricePerBed");
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("hostelId")
      .populate("roomId")
      .populate("userId", "name email");

    if (!booking) {
      return res.status(404).json({ msg: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ msg: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ msg: "Booking already cancelled" });
    }

    if (booking.status === "confirmed") {
      // Restore availability only for confirmed bookings
      const room = await Room.findById(booking.roomId);
      room.availableBeds += booking.bedsBooked;
      await room.save();
    }

    booking.status = "cancelled";
    booking.bedNumbers = [];
    await booking.save();

    res.json(booking);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Get bookings for owner's hostels
export const getOwnerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: "hostelId",
        match: { ownerId: req.user.id },
        select: "name addressLine1 addressLine2 city gender",
      })
      .populate("roomId", "roomType pricePerBed")
      .populate("userId", "name email");

    // Filter out bookings where hostel is null (doesn't belong to this owner)
    const ownerBookings = bookings.filter((b) => b.hostelId !== null);

    res.json(ownerBookings);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Accept booking (owner)
export const acceptBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("hostelId")
      .populate("roomId");

    if (!booking) {
      return res.status(404).json({ msg: "Booking not found" });
    }

    // Verify owner owns this hostel
    if (String(booking.hostelId?.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ msg: "Cannot accept a cancelled booking" });
    }

    if (booking.status !== "confirmed") {
      const room = await Room.findById(booking.roomId?._id || booking.roomId);
      if (!room) {
        return res.status(404).json({ msg: "Room not found" });
      }

      if (room.availableBeds < booking.bedsBooked) {
        return res.status(400).json({ msg: "Not enough available beds" });
      }

      const activeBookings = await getActiveRoomBookings(
        booking.roomId?._id || booking.roomId,
        booking._id,
      );
      const occupiedSet = extractOccupiedBeds(activeBookings);
      const assignedBeds = allocateBedNumbers(
        room.totalBeds,
        occupiedSet,
        Number(booking.bedsBooked),
      );

      if (assignedBeds.length !== Number(booking.bedsBooked)) {
        return res.status(400).json({ msg: "Not enough available beds" });
      }

      booking.bedNumbers = assignedBeds;
      room.availableBeds -= booking.bedsBooked;
      await room.save();
    }

    booking.status = "confirmed";
    await booking.save();

    res.json(booking);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// Reject/Cancel booking (owner)
export const rejectBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("hostelId")
      .populate("roomId");

    if (!booking) {
      return res.status(404).json({ msg: "Booking not found" });
    }

    // Verify owner owns this hostel
    if (String(booking.hostelId?.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ msg: "Booking already cancelled" });
    }

    if (booking.status === "confirmed") {
      // Restore room availability only when confirmed booking is cancelled
      const room = await Room.findById(booking.roomId);
      room.availableBeds += booking.bedsBooked;
      await room.save();
    }

    booking.status = "cancelled";
    booking.bedNumbers = [];
    await booking.save();

    res.json(booking);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
