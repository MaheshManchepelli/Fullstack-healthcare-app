const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dayOfWeek: { type: String, required: true }, // e.g. "Monday"
  startTime: { type: String, required: true }, // e.g. "09:00"
  endTime: { type: String, required: true },   // e.g. "17:00"
});

module.exports = mongoose.model("Availability", availabilitySchema);
