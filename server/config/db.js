const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/api-tester", {
      serverSelectionTimeoutMS: 3000,
      bufferCommands: false,
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.error("History/analytics features will be unavailable until MongoDB is running.");
    // Mongoose will keep retrying — don't exit, let the API still serve requests
  }
};

module.exports = connectDB;
