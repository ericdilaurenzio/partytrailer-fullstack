import express from "express";
import { booqableGet } from "../integrations/booqableClient.js";
import Reservation from "../models/Reservation.js";

const router = express.Router();

// GET /api/sync/booqable/reservations
router.get("/reservations", async (req, res, next) => {
  try {
    let page = 1, imported = 0;
    for (;;) {
      // Update path/keys if your account differs
      const data = await booqableGet("/v1/reservations", { page, per_page: 50, sort: "-updated_at" });
      const records = data.reservations || data.data || [];
      if (!records.length) break;

      for (const r of records) {
        await Reservation.updateOne(
          { externalSystem: "booqable", externalId: r.id },
          {
            $set: {
              status: r.status || "pending",
              customer: {
                name: r.customer?.name || [r.customer?.first_name, r.customer?.last_name].filter(Boolean).join(" "),
                email: r.customer?.email || null,
                phone: r.customer?.phone || null,
                externalCustomerId: r.customer?.id
              },
              items: (r.items || r.lines || []).map(li => ({
                booqableId: li.item_id || li.product_id || li.id,
                inventoryItemId: null,
                qty: li.quantity ?? 1,
                name: li.name || li.title || "Item"
              })),
              startAt: r.start_at || r.starts_at || r.starts_on || null,
              endAt: r.end_at || r.ends_at || r.ends_on || null,
              delivery: typeof r.delivery === "object" ? { address: r.delivery?.address || "", notes: r.delivery?.notes || "" } : null,
              totals: {
                subtotal: Number(r.subtotal_amount ?? 0),
                tax: Number(r.tax_amount ?? 0),
                delivery: Number(r.delivery_amount ?? 0),
                securityDeposit: Number(r.deposit_amount ?? 0),
                grandTotal: Number(r.total_amount ?? 0)
              },
              payment: {
                required: r.payment_required ?? true,
                collected: Number(r.amount_paid ?? 0),
                currency: r.currency || "USD"
              },
              notes: r.notes || "",
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