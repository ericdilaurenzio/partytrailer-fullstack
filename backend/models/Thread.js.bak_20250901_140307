const mongoose = require("mongoose");

const ThreadSchema = new mongoose.Schema(
  {
    // Optional slug so URLs can use strings like "general-support"
    slug: { type: String, unique: true, sparse: true, index: true },

    // Participants you've used before
    participants: [String], // e.g., ["cus_abc", "admin:eric"]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Thread", ThreadSchema);
