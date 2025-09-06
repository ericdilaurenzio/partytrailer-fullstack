import express from "express";
import Reservation from "../models/Reservation.js";

const router = express.Router();

// GET /api/reservations?q=...
router.get("/reservations", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = q ? {
      $or: [
        { "customer.name": new RegExp(q, "i") },
        { "customer.email": new RegExp(q, "i") },
        { externalId: new RegExp(q, "i") },
        { status: new RegExp(q, "i") }
      ]
    } : {};
    const items = await Reservation.find(filter).sort({ startAt: 1 }).limit(500).lean();
    res.json({ ok: true, reservations: items });
  } catch (e) { next(e); }
});

export default router;