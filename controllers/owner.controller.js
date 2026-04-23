import Hostel from "../models/Hostel.js";
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";

const safePercentChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
};

export const getOwnerKpis = async (req, res) => {
  try {
    const ownerId = req.user && (req.user._id || req.user.id);
    if (!ownerId) return res.status(400).json({ msg: "Missing owner id" });

    const now = new Date();
    // Current month range
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    // Previous month range
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month

    const hostels = await Hostel.find({ ownerId });
    const hostelIds = hostels.map((h) => h._id);

    // Hostels counts
    const totalHostels = hostels.length;
    const newHostels = await Hostel.countDocuments({ ownerId, createdAt: { $gte: currentMonthStart, $lt: nextMonthStart } });
    const prevNewHostels = await Hostel.countDocuments({ ownerId, createdAt: { $gte: prevMonthStart, $lt: currentMonthStart } });
    const hostelDelta = newHostels - prevNewHostels;

    // Rooms
    const rooms = await Room.find({ hostelId: { $in: hostelIds } });
    const totalRooms = rooms.length;
    const roomsAdded = await Room.countDocuments({ hostelId: { $in: hostelIds }, createdAt: { $gte: currentMonthStart, $lt: nextMonthStart } });
    const prevRoomsAdded = await Room.countDocuments({ hostelId: { $in: hostelIds }, createdAt: { $gte: prevMonthStart, $lt: currentMonthStart } });
    const roomsDelta = roomsAdded - prevRoomsAdded;

    const totalBeds = rooms.reduce((s, r) => s + (r.totalBeds || 0), 0);

    // Bookings & revenue
    const bookingsThisMonth = await Booking.find({
      hostelId: { $in: hostelIds },
      createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
    });

    const bookingsPrevMonth = await Booking.find({
      hostelId: { $in: hostelIds },
      createdAt: { $gte: prevMonthStart, $lt: currentMonthStart },
    });

    const revenueThisMonth = bookingsThisMonth
      .filter((b) => ["confirmed", "completed"].includes(String(b.status)))
      .reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);

    const revenuePrevMonth = bookingsPrevMonth
      .filter((b) => ["confirmed", "completed"].includes(String(b.status)))
      .reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);

    const occupiedBedsThisMonth = bookingsThisMonth
      .filter((b) => ["confirmed", "pending"].includes(String(b.status)))
      .reduce((s, b) => s + (Number(b.bedsBooked || b.beds || 1) || 0), 0);

    const occupiedBedsPrevMonth = bookingsPrevMonth
      .filter((b) => ["confirmed", "pending"].includes(String(b.status)))
      .reduce((s, b) => s + (Number(b.bedsBooked || b.beds || 1) || 0), 0);

    const occupancyThisPct = totalBeds > 0 ? Math.round((occupiedBedsThisMonth / totalBeds) * 100) : 0;
    const occupancyPrevPct = totalBeds > 0 ? Math.round((occupiedBedsPrevMonth / totalBeds) * 100) : 0;

    const activeBookings = await Booking.countDocuments({
      hostelId: { $in: hostelIds },
      status: { $in: ["confirmed", "pending"] },
      createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
    });
    const activePrev = await Booking.countDocuments({
      hostelId: { $in: hostelIds },
      status: { $in: ["confirmed", "pending"] },
      createdAt: { $gte: prevMonthStart, $lt: currentMonthStart },
    });

    // Avg night price (current)
    const pricedRooms = rooms.filter((r) => Number.isFinite(Number(r.pricePerBed)) && r.pricePerBed > 0);
    // Avg monthly price: average booking total price per booking in the month
    const bookingsCountThisMonth = bookingsThisMonth.length || 0;
    const bookingsCountPrevMonth = bookingsPrevMonth.length || 0;
    const avgMonthlyPrice = bookingsCountThisMonth ? Math.round(revenueThisMonth / bookingsCountThisMonth) : 0;
    const prevAvgMonthlyPrice = bookingsCountPrevMonth ? Math.round(revenuePrevMonth / bookingsCountPrevMonth) : avgMonthlyPrice;

    // Build KPI items
    const kpis = [
      {
        key: "totalHostels",
        title: "Total Hostels",
        value: totalHostels,
        badge: hostelDelta > 0 ? `+${hostelDelta} New` : hostelDelta < 0 ? `${hostelDelta} New` : undefined,
      },
      {
        key: "totalRooms",
        title: "Total Rooms",
        value: totalRooms,
        badge: roomsDelta > 0 ? `+${roomsDelta} New` : roomsDelta < 0 ? `${roomsDelta} New` : undefined,
      },
      {
        key: "occupancyRate",
        title: "Occupancy Rate",
        value: `${occupancyThisPct}%`,
        trend: occupancyThisPct > occupancyPrevPct ? "up" : occupancyThisPct < occupancyPrevPct ? "down" : "stable",
        trendValue: `${safePercentChange(occupancyThisPct, occupancyPrevPct)}%`,
      },
      {
        key: "monthlyRevenue",
        title: "Monthly Revenue",
        value: `Rs ${Math.round(revenueThisMonth).toLocaleString()}`,
        trend: revenueThisMonth > revenuePrevMonth ? "up" : revenueThisMonth < revenuePrevMonth ? "down" : "stable",
        trendValue: `${safePercentChange(revenueThisMonth, revenuePrevMonth)}%`,
        colorClass: "text-blue-600",
      },
      {
        key: "activeBookings",
        title: "Active Bookings",
        value: activeBookings,
        trend: activeBookings > activePrev ? "up" : activeBookings < activePrev ? "down" : "stable",
        trendValue: activeBookings > activePrev ? `+${activeBookings - activePrev}` : activeBookings < activePrev ? `${activeBookings - activePrev}` : "Stable",
      },
      {
        key: "avgMonthlyPrice",
        title: "Avg Monthly Price",
        value: `Rs ${avgMonthlyPrice.toLocaleString()}`,
        trend: avgMonthlyPrice > prevAvgMonthlyPrice ? "up" : avgMonthlyPrice < prevAvgMonthlyPrice ? "down" : "stable",
        trendValue: prevAvgMonthlyPrice ? `${safePercentChange(avgMonthlyPrice, prevAvgMonthlyPrice)}%` : `${bookingsCountThisMonth} bookings`,
        colorClass: "text-purple-600",
      },
    ];

    res.json({ kpis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
};

export default {
  getOwnerKpis,
};
