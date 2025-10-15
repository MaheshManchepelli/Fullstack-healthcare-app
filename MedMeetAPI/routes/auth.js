const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, specialization, bio, location } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      passwordHash,
      role,
      specialization,
      bio,
      location,
    });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /auth/me (protected)
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /auth/doctors
router.get("/doctors", auth, async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" }).select("-passwordHash -__v");
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /auth/doctors/:id
router.get("/doctors/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash -__v");
    if (!user || user.role !== "doctor") {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /auth/update (protected)
router.put("/update", auth, async (req, res) => {
  try {
    const { name, email, role, specialization, bio, location, photo } = req.body;
    const userId = req.user.id; // Ensure req.user is set by your auth middleware

    // Prepare update object
    const updateData = {
      name,
      email,
      role,
      bio,
      location,
      photo, // Supabase URL
    };

    // Add specialization if role is doctor
    if (role === "doctor") {
      updateData.specialization = specialization;
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData }, // Use $set to avoid modifying read-only properties
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});


module.exports = router;
