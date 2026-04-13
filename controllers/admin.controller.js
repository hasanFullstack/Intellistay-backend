import User from "../models/User.js";
import Hostel from "../models/Hostel.js";

export const getUnverifiedOwners = async (req, res) => {
  try {
    const owners = await User.find({
      role: "owner",
      isVerified: false,
    });
    res.json(owners);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const verifyOwner = async (req, res) => {
  try {
    const owner = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true },
    );
    res.json(owner);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getAllHostelsAdmin = async (req, res) => {
  try {
    const hostels = await Hostel.find().populate("ownerId", "name email");
    res.json(hostels);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
