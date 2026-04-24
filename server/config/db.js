const mongoose = require("mongoose");

// Cache the connection across serverless invocations
let cached = global._mongooseConn || (global._mongooseConn = { conn: null, promise: null });

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/api-tester";

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 5000 })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;
        console.error("MongoDB connection failed:", err.message);
        console.error("History/analytics features will be unavailable until MongoDB is running.");
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
