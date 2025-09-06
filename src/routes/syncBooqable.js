import express from "express";
import InventoryItem from "../models/InventoryItem.js";
import { booqableGet } from "../integrations/booqableClient.js";

const router = express.Router();

// Admin-only in the future; for now open while we wire things up.
router.get("/inventory", async (req, res, next) => {
  try {
    let page = 1, imported = 0;
    for (;;) {
      // TODO: If your account uses a different path, update here.
      const data = await booqableGet("/v1/items", { page, per_page: 100 });
      const items = data.items || data.data || [];
      if (!items.length) break;

      for (const it of items) {
        await InventoryItem.updateOne(
          { booqableId: it.id },
          {
            $set: {
              name: it.name,
              sku: it.sku || it.code || null,
              category: it.category || null,
              stockCount: it.stock ?? it.quantity ?? 0,
              attributes: it.attributes || {},
              images: Array.isArray(it.images) ? it.images.map(i => i.url || i) : [],
              active: it.active !== false,
              lastSyncedAt: new Date()
            }
          },
          { upsert: true }
        );
        imported++;
      }
      page++;
    }
    res.json({ ok: true, imported });
  } catch (e) { next(e); }
});

export default router;