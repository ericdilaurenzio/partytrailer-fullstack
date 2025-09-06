// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Routers
import syncBooqableRouter from "./src/routes/syncBooqable.js";
import inventoryRouter from "./src/routes/inventory.js";
import syncBooqableReservationsRouter from "./src/routes/syncBooqableReservations.js";
import reservationsRouter from "./src/routes/reservations.js";

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/partytrailer";

app.use(cors({
  origin: [
    "http://localhost:19006",
    "http://localhost:19000",
    "http://127.0.0.1:19006",
    "http://127.0.0.1:19000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

mongoose.set("strictQuery", false);
mongoose.connect(MONGO_URI, { autoIndex: true })
  .then(() => console.log("[MongoDB] connected"))
  .catch((err) => {
    console.error("[MongoDB] connection error:", err?.message || err);
    process.exit(1);
  });

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

// API routes
app.use("/api/sync/booqable", syncBooqableRouter);

// Reservations: sync + list
app.use("/api/sync/booqable", syncBooqableReservationsRouter);
app.use("/api", reservationsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.originalUrl });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error("[Error]", err);
  res.status(err.status || 500).json({ ok: false, error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`[Server] listening on http://localhost:${PORT}`);
  if (!process.env.BOOQABLE_API_KEY) {
    console.warn("[Warn] BOOQABLE_API_KEY not set. Inventory import will fail until you set it in .env");
  }
});

