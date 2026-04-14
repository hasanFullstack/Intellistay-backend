import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Reduce buffering timeout (default is 10000ms).
      // Set lower if you want operations to fail faster when DB is unreachable.
      bufferTimeoutMS: 3000,
      // Fail fast on server selection if unable to connect.
      serverSelectionTimeoutMS: 3000,
    });

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("DB Error:", error.message);
    process.exit(1);
  }
};

export default connectDB;
