const express = require("express");
const User = require("../models/User");
const Availability = require("../models/Availability");
const Appointment = require("../models/Appointment");
const auth = require("../middleware/auth");

const router = express.Router();

// 🔹 GET /doctors?specialization=cardio
router.get("/", async (req, res) => {
  try {
    const filter = { role: "doctor" };
    if (req.query.specialization) {
      filter.specialization = { $regex: req.query.specialization, $options: "i" };
    }

    const doctors = await User.find(filter).select("-passwordHash -__v");
    res.json(doctors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 GET /doctors/:id
router.get("/:id", async (req, res) => {
  try {
    const doctor = await User.findById(req.params.id).select("-passwordHash -__v");
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 PATCH /doctors/:id  (Protected — only doctor himself)
router.patch("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "doctor" || req.user.id !== req.params.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates = (({ bio, specialization, location }) => ({ bio, specialization, location }))(req.body);

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-passwordHash -__v");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 POST /availability  (Add slots — doctor only)
router.post("/availability", auth, async (req, res) => {
  try {
    if (req.user.role !== "doctor") return res.status(403).json({ message: "Only doctors can add availability" });

    const { dayOfWeek, startTime, endTime } = req.body;
    if (!dayOfWeek || !startTime || !endTime)
      return res.status(400).json({ message: "All fields required" });

    const slot = new Availability({
      doctorId: req.user.id,
      dayOfWeek,
      startTime,
      endTime,
    });

    await slot.save();
    res.status(201).json(slot);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 GET /doctors/:id/availability
router.get("/:id/availability", async (req, res) => {
  try {
    const slots = await Availability.find({ doctorId: req.params.id });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 GET /doctors/:id/available-slots?date=YYYY-MM-DD
router.get("/:id/available-slots", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: "Date parameter is required" });
    }

    const doctorId = req.params.id;
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();

    // Find the doctor's availability for this day of the week
    const availability = await Availability.findOne({
      doctorId,
      dayOfWeek
    });

    if (!availability) {
      return res.json({ availableSlots: [] });
    }

    // Generate time slots between startTime and endTime
    const startTime = parseTime(availability.startTime);
    const endTime = parseTime(availability.endTime);
    const slots = [];

    // Generate 30-minute slots
    for (let hour = startTime.hours; hour < endTime.hours; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === endTime.hours && minute >= endTime.minutes) break;

        const slotStart = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotEndHour = minute + 30 >= 60 ? hour + 1 : hour;
        const slotEndMinute = minute + 30 >= 60 ? (minute + 30) % 60 : minute + 30;
        const slotEnd = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMinute.toString().padStart(2, '0')}`;
        const slotTime = `${slotStart} - ${slotEnd}`;

        slots.push({
          time: slotTime,
          isAvailable: true // In a real app, you'd check if this slot is already booked
        });
      }
    }

    // Check for existing appointments on this date and mark slots as unavailable
    const existingAppointments = await Appointment.find({
      doctorId,
      date: new Date(date).toISOString().split('T')[0],
      status: { $ne: "cancelled" }
    });

    // Mark slots as unavailable if they're already booked
    const bookedSlots = existingAppointments.map(appt => appt.time);
    const availableSlots = slots.map(slot => ({
      ...slot,
      isAvailable: !bookedSlots.includes(slot.time)
    }));

    res.json({ availableSlots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Helper function to parse time strings
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

// 🔹 POST /appointments
router.post("/appointments", auth, async (req, res) => {
  try {
    const { doctorId, date, time, reason } = req.body;

    if (!doctorId || !date || !time || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if the slot is available
    const existingAppointment = await Appointment.findOne({
      doctorId,
      date,
      time,
      status: { $ne: "cancelled" }
    });

    if (existingAppointment) {
      return res.status(400).json({ message: "This time slot is already booked" });
    }

    // Create new appointment
    const appointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      date,
      time,
      reason,
      status: "pending"
    });

    await appointment.save();
    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 GET /appointments (Get appointments for the current user)
router.get("/appointments", auth, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id })
      .populate('doctorId', 'name specialization photo')
      .sort({ date: 1, time: 1 });

    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
