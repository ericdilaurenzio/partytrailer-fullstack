const mongoose = require("mongoose");

const ThreadSchema = new mongoose.Schema(
  {
    // Optional human-friendly slug so you can use /threads/general-support
    slug: { type: String, unique: true, sparse: true, index: true },
    participants: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Thread", ThreadSchema);
