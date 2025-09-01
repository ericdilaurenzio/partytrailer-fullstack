require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// Mongo
const URI = process.env.MONGO_URI;
if (!URI) {
  console.error("Missing MONGO_URI environment variable");
  process.exit(1);
}
mongoose.connect(URI)
  .then(() => console.log("Mongo connected"))
  .catch((e) => { console.error("Mongo connect error:", e); process.exit(1); });

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

// API
app.use("/api/messages", require("./routes/messages.routes"));

// Start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
