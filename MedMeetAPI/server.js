// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth");
const doctorRoutes = require("./routes/doctor");

const app = express();
const PORT = process.env.PORT || 5000;

// ========================
// Middleware
// ========================
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(helmet());
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

// ========================
// MongoDB Connection with Retry
// ========================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: "medMeet",
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

// ========================
// Routes
// ========================
app.get("/", (req, res) => res.json({ message: "API is running 🚀" }));
app.use("/auth", authRoutes);
app.use("/doctors", doctorRoutes); // ✅ Register doctor routes

// ========================
// Global Error Handler
// ========================
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.stack);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// ========================
// Start Server
// ========================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
