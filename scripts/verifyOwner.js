import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/Users.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/verifyOwner.js <owner-email>");
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      dbName: process.env.DB_NAME || undefined,
    });
    console.log("Connected to MongoDB");

    const res = await User.findOneAndUpdate(
      { email: String(email).toLowerCase().trim() },
      { $set: { role: "owner", isVerified: true } },
      { new: true },
    );

    if (!res) {
      console.error("User not found with email:", email);
    } else {
      console.log("Updated user:", {
        email: res.email,
        role: res.role,
        isVerified: res.isVerified,
        });
    }
  } catch (err) {
    console.error("Error:", err.message || err);
  } finally {
    mongoose.connection.close();
  }
};

run();
