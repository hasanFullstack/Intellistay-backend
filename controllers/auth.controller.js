import User from "../models/Users.js";
import { resolveImageUrls } from "../utils/cdnUpload.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      isVerified: role === "student", // owners need admin approval
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, description, image } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (email && String(email).toLowerCase() !== String(user.email).toLowerCase()) {
      const exists = await User.findOne({ email: String(email).toLowerCase() });
      if (exists) return res.status(400).json({ msg: "Email already in use" });
      user.email = String(email).toLowerCase();
    }

    if (name) user.name = name;
    if (description !== undefined) user.description = description;
    if (image !== undefined) {
      // If image looks like a data URL or base64, upload it to CDN and store the resolved URL
      if (typeof image === "string" && image.startsWith("data:")) {
        try {
          const uploaded = await resolveImageUrls([image], "intellistay/owners");
          user.image = Array.isArray(uploaded) && uploaded[0] ? uploaded[0] : "";
        } catch (err) {
          // fallback to storing raw image string if upload fails
          user.image = image;
        }
      } else {
        user.image = image;
      }
    }

    await user.save();

    const returned = user.toObject();
    delete returned.password;

    res.json({ user: returned });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
