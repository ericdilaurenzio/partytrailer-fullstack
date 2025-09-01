const router = require("express").Router();
const Thread = require("../models/Thread");
const Message = require("../models/Message");

const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(v);

async function ensureThreadBySlug(slug) {
  let t = await Thread.findOne({ slug });
  if (!t) t = await Thread.create({ slug, participants: ["admin:eric"] });
  return t;
}

// GET messages in a thread (by slug or ObjectId); for slug, auto-create empty thread
router.get("/threads/:key/messages", async (req, res) => {
  try {
    const { key } = req.params;
    let thread = isObjectId(key) ? await Thread.findById(key) : await ensureThreadBySlug(key);
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const msgs = await Message.find({ threadId: thread._id }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (e) {
    console.error("GET thread messages error:", e);
    res.status(500).json({ error: "Internal error" });
  }
});

// POST a message to a thread (by slug or ObjectId); slug path upserts thread
router.post("/threads/:key/messages", async (req, res) => {
  try {
    const { key } = req.params;
    const { sender, body } = req.body || {};
    if (!sender || !body) return res.status(400).json({ error: "sender and body required" });

    let thread = isObjectId(key) ? await Thread.findById(key) : await ensureThreadBySlug(key);
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const msg = await Message.create({ threadId: thread._id, sender, body });
    res.status(201).json(msg);
  } catch (e) {
    console.error("POST thread message error:", e);
    res.status(500).json({ error: "Internal error" });
  }
});

module.exports = router;
