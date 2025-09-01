const mongoose = require("mongoose");
const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "Thread", required: true },
    sender:   { type: String, required: true },
    body:     { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
