const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Thread = require("../models/Thread");
const Message = require("../models/Message");

// Resolve a thread by slug OR ObjectId; if slug and not found, optionally create
async function resolveThreadId(idOrSlug, opts = { createIfMissing: true }) {
  if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
    return idOrSlug;
  }
  // treat as slug
  let th = await Thread.findOne({ slug: idOrSlug });
  if (!th && opts.createIfMissing) {
    th = await Thread.create({ slug: idOrSlug, participants: [] });
  }
  if (!th) throw new Error("thread not found");
  return th._id.toString();
}

// GET /api/messages/threads/:id/messages
router.get("/threads/:id/messages", async (req, res) => {
  try {
    const tid = await resolveThreadId(req.params.id, { createIfMissing: false });
    const msgs = await Message.find({ threadId: tid }).sort({ createdAt: 1 }).lean();
    res.json(msgs);
  } catch (e) {
    res.status(500).json({ error: e.message || "failed to load messages" });
  }
});

// POST /api/messages/threads/:id/messages { sender, body }
router.post("/threads/:id/messages", async (req, res) => {
  try {
    const { sender, body } = req.body || {};
    if (!sender || !body) return res.status(400).json({ error: "sender and body are required" });
    const tid = await resolveThreadId(req.params.id, { createIfMissing: true });
    const saved = await Message.create({ threadId: tid, sender, body });
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: e.message || "failed to send message" });
  }
});

module.exports = router;
