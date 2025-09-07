require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const dayjs = require("dayjs");

// --- ENV ---
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// --- APP/HTTP ---
const app = express();
const server = http.createServer(app);

// --- CORS ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// --- DB ---
mongoose.set("strictQuery", true);
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Mongo connected"))
  .catch((e) => console.error("Mongo error:", e));

// --- MODELS ---
const UserSchema = new mongoose.Schema({
  role: { type: String, enum: ["admin", "customer"], default: "customer" },
  name: String,
  phone: String,
  email: String,
}, { timestamps: true });

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  subject: String,
  status: { type: String, enum: ["open", "closed"], default: "open" }
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  body: String,
  read: { type: Boolean, default: false }
}, { timestamps: true });

const AvailabilitySchema = new mongoose.Schema({
  businessHours: {
    type: Object,
    default: {
      "1":[{start:"09:00",end:"17:00"}],
      "2":[{start:"09:00",end:"17:00"}],
      "3":[{start:"09:00",end:"17:00"}],
      "4":[{start:"09:00",end:"17:00"}],
      "5":[{start:"09:00",end:"17:00"}],
      "6":[],
      "0":[]
    }
  },
  slotMinutes: { type: Number, default: 60 },
  blackoutDates: [{ type: String }],
}, { timestamps: true });

const BookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  startISO: String,
  endISO: String,
  note: String,
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);
const Conversation = mongoose.model("Conversation", ConversationSchema);
const Message = mongoose.model("Message", MessageSchema);
const Availability = mongoose.model("Availability", AvailabilitySchema);
const Booking = mongoose.model("Booking", BookingSchema);

// --- SOCKET.IO ---
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

io.on("connection", (socket) => {
  socket.on("joinConversation", (conversationId) => {
    socket.join(`conv:${conversationId}`);
  });

  socket.on("sendMessage", async (payload, ack) => {
    try {
      const { conversationId, senderId, body } = payload;
      const msg = await Message.create({ conversationId, senderId, body });
      io.to(`conv:${conversationId}`).emit("messageCreated", msg);
      ack && ack({ ok: true, message: msg });
    } catch (e) {
      ack && ack({ ok: false, error: e.message });
    }
  });
});

// --- ROUTES ---
app.get("/health", (_, res) => res.json({ ok: true }));
// --- NEW: list conversations for a user with unread counts ---
app.get('/api/conversations/for/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const convs = await Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .lean();

    const convIds = convs.map(c => c._id);
    const lastMsgs = await Message.aggregate([
      { $match: { conversationId: { $in: convIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversationId", last: { $first: "$$ROOT" } } },
    ]);

    const unreadCounts = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: convIds },
          read: false,
          senderId: { $ne: userId },
        }
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } }
    ]);

    const lastById = Object.fromEntries(lastMsgs.map(x => [String(x._id), x.last]));
    const unreadById = Object.fromEntries(unreadCounts.map(x => [String(x._id), x.count]));

    const data = convs.map(c => ({
      _id: String(c._id),
      participants: c.participants,
      subject: c.subject,
      updatedAt: c.updatedAt,
      lastMessage: lastById[String(c._id)] || null,
      unread: unreadById[String(c._id)] || 0,
    }));

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to load conversations' });
  }
});

// --- NEW: mark all incoming messages as read for a conversation ---
app.patch('/api/conversations/:id/read', async (req, res) => {
  try {
    const convId = req.params.id;
    const { viewerId } = req.body; // who is marking as read
    await Message.updateMany(
      { conversationId: convId, senderId: { $ne: viewerId }, read: false },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed to mark read' });
  }
});

// Users
app.post("/api/users", async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});

// Conversations
app.post("/api/conversations", async (req, res) => {
  const convo = await Conversation.create(req.body);
  res.json(convo);
});

app.get("/api/conversations/:id/messages", async (req, res) => {
  const msgs = await Message.find({ conversationId: req.params.id }).sort({ createdAt: 1 });
  res.json(msgs);
});

app.post("/api/messages", async (req, res) => {
  const msg = await Message.create(req.body);
  io.to(`conv:${req.body.conversationId}`).emit("messageCreated", msg);
  res.json(msg);
});

// Availability
app.get("/api/availability/config", async (_req, res) => {
  let cfg = await Availability.findOne();
  if (!cfg) cfg = await Availability.create({});
  res.json(cfg);
});

app.put("/api/availability/config", async (req, res) => {
  let cfg = await Availability.findOne();
  if (!cfg) cfg = await Availability.create({});
  Object.assign(cfg, req.body);
  await cfg.save();
  res.json(cfg);
});

// Bookings
app.post("/api/bookings", async (req, res) => {
  const { customerId, startISO, endISO, note } = req.body;
  const conflict = await Booking.findOne({
    $or: [{ startISO: { $lt: endISO }, endISO: { $gt: startISO } }]
  });
  if (conflict) return res.status(409).json({ ok: false, error: "Slot unavailable" });

  const booking = await Booking.create({ customerId, startISO, endISO, note });
  res.json({ ok: true, booking });
});

// --- START ---
server.listen(PORT, () => console.log(`✅ API & Socket.IO running on http://localhost:${PORT}`));
