// server.js
// Clean Express server with MongoDB, CORS, and Booqable inventory routes wired.
// ESM module syntax. Requires: "type": "module" in package.json.

import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Routers created in Step 1
import syncBooqableRouter from "./src/routes/syncBooqable.js";
import inventoryRouter from "./src/routes/inventory.js";
import booqableCreateBookingRouter from "./src/routes/booqableCreateBooking.js";

// ===== Resolve __dirname (ESM) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== App & Config =====
const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/partytrailer"; // change if you use a different DB name

// ===== Middleware =====
app.use(
  cors({
    origin: [
      // Common Expo/React Native dev origins; add your web origin if needed
      "http://localhost:19006",
      "http://localhost:19000",
      "http://127.0.0.1:19006",
      "http://127.0.0.1:19000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      // Add your Render/production front-end origin here when deployed
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(express.json());

// ===== Database =====
mongoose.set("strictQuery", false);
mongoose
  .connect(MONGO_URI, {
    autoIndex: true,
  })
  .then(() => {
    console.log("[MongoDB] connected");
  })
  .catch((err) => {
    console.error("[MongoDB] connection error:", err?.message || err);
    process.exit(1);
  });

// ===== Health & Version =====
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "partytrailer-api", time: new Date().toISOString() });
});
app.get("/version", (_req, res) => {
  res.json({
    name: "partytrailer-api",
    version: process.env.npm_package_version || "0.0.0",
    node: process.version,
    env: process.env.NODE_ENV || "development",
  });
});

// ===== API Routes =====
// Booqable inventory import (admin-protect later)
app.use("/api/sync/booqable", syncBooqableRouter);
app.use(express.json());

// Local inventory listing (used by mobile UI)
app.use("/api", inventoryRouter);
app.use(express.json());

// ===== Static (optional): serve a public folder if you have one =====
// const publicDir = path.join(__dirname, "public");
// app.use(express.static(publicDir));
app.use(express.json());

// ===== 404 =====
app.use((req, res, next) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.originalUrl });
});

// ===== Error Handler =====
app.use((err, req, res, _next) => {
  console.error("[Error]", err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: err.message || "Internal Server Error",
  });
});

// ===== Start Server =====
// Booqable: create booking
app.use("/api/sync/booqable", booqableCreateBookingRouter);
app.listen(PORT, () => {
  console.log(`[Server] listening on http://localhost:${PORT}`);
  if (!process.env.BOOQABLE_API_KEY) {
    console.warn(
      "[Warn] BOOQABLE_API_KEY not set. /api/sync/booqable/inventory will fail until you add it to .env"
    );
  }
});

