import express from "express";
import InventoryItem from "../models/InventoryItem.js";

const router = express.Router();

// GET /api/inventory
router.get("/inventory", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = q
      ? { $or: [{ name: new RegExp(q, "i") }, { sku: new RegExp(q, "i") }] }
      : {};
    const items = await InventoryItem.find(filter).sort({ name: 1 }).lean();
    res.json({ ok: true, items });
  } catch (e) { next(e); }
});

export default router;