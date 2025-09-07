require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 10000;

// safety + basic middleware
app.use(cors());
app.use(express.json());

// health check
app.get("/health", (req, res) => res.json({ ok: true }));

// mount messages router
app.use("/api/messages", require("./routes/messages.routes"));

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

async function start() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error("Missing MONGO_URI env var.");
      process.exit(1);
    }
    await mongoose.connect(uri);
    console.log("âœ… MongoDB connected");
    app.listen(PORT, () => console.log(`ðŸš€ Server listening on :${PORT}`));
  } catch (e) {
    console.error("Mongo error:", e);
    process.exit(1);
  }
}

start();
