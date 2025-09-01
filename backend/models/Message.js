const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: "Thread" },
    // Also store the slug for convenience when using slug-based threads
    threadSlug: { type: String },
    sender: { type: String, required: true },
    body:   { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
