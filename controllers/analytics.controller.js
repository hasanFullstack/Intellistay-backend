import Booking from "../models/Booking.js";

export const ownerAnalytics = async (req, res) => {
  try {
    const bookings = await Booking.find().populate("hostelId");

    const ownerBookings = bookings.filter(
      (b) => String(b.hostelId?.ownerId) === String(req.user.id),
    );

    const totalRevenue = ownerBookings.reduce(
      (sum, b) => sum + b.priceAtBooking,
      0,
    );

    res.json({
      totalBookings: ownerBookings.length,
      totalRevenue,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
