const router = require("express").Router();
const mongoose = require("mongoose");
const Thread = require("../models/Thread");
const Message = require("../models/Message");

function isObjectId(str) {
  return mongoose.Types.ObjectId.isValid(str);
}

async function ensureThreadBySlug(slug) {
  let t = await Thread.findOne({ slug });
  if (!t) {
    t = await Thread.create({ slug, participants: [] });
  }
  return t;
}

// GET messages for thread by ObjectId or slug
router.get("/threads/:idOrSlug/messages", async (req, res) => {
  try {
    const key = req.params.idOrSlug;
    if (isObjectId(key)) {
      const thread = await Thread.findById(key);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      const msgs = await Message.find({ threadId: thread._id }).sort({ createdAt: -1 });
      return res.json(msgs);
    }
    // slug path
    const thread = await ensureThreadBySlug(key);
    const msgs = await Message.find({
      $or: [{ threadId: thread._id }, { threadSlug: key }],
    }).sort({ createdAt: -1 });
    return res.json(msgs);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// POST message to thread by ObjectId or slug
router.post("/threads/:idOrSlug/messages", async (req, res) => {
  try {
    const key = req.params.idOrSlug;
    const { sender, body } = req.body || {};
    if (!sender || !body) {
      return res.status(400).json({ error: "sender and body are required" });
    }
    let payload = { sender, body };

    if (isObjectId(key)) {
      const thread = await Thread.findById(key);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      payload.threadId = thread._id;
    } else {
      const thread = await ensureThreadBySlug(key);
      payload.threadId = thread._id;
      payload.threadSlug = key;
    }

    const saved = await Message.create(payload);
    return res.status(201).json(saved);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
