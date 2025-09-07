import express from "express";
import { booqableProbeReservations, booqableGetKnown } from "../integrations/booqableClient.js";
import Reservation from "../models/Reservation.js";

const router = express.Router();

function extractList(obj) {
  if (!obj || typeof obj !== "object") return [];
  for (const k of ["orders","reservations","bookings","data","items","results"]) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  if (obj.response && Array.isArray(obj.response)) return obj.response;
  return [];
}

function norm(r) {
  const customer = r.customer || r.account || r.customer_details || {};
  const items = r.items || r.lines || r.line_items || [];
  return {
    externalId: r.id || r.uuid,
    status: r.status || r.state || "pending",
    customer: {
      name: customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "",
      email: customer.email || "",
      phone: customer.phone || "",
      externalCustomerId: customer.id || customer.uuid || ""
    },
    items: items.map(li => ({
      booqableId: li.item_id || li.product_id || li.id || "",
      inventoryItemId: null,
      qty: li.quantity ?? 1,
      name: li.name || li.title || "Item"
    })),
    startAt: r.start_at || r.starts_at || r.starts_on || r.start || r.start_time || null,
    endAt:   r.end_at   || r.ends_at   || r.ends_on   || r.end   || r.end_time   || null,
    delivery: typeof r.delivery === "object" ? { address: r.delivery?.address || "", notes: r.delivery?.notes || "" } : null,
    totals: {
      subtotal: Number(r.subtotal_amount ?? r.subtotal ?? 0),
      tax: Number(r.tax_amount ?? r.tax ?? 0),
      delivery: Number(r.delivery_amount ?? 0),
      securityDeposit: Number(r.deposit_amount ?? 0),
      grandTotal: Number(r.total_amount ?? r.total ?? 0)
    },
    payment: {
      required: (r.payment_required ?? r.payment_due ?? true) ? true : false,
      collected: Number(r.amount_paid ?? r.paid_amount ?? 0),
      currency: r.currency || "USD"
    },
    notes: r.notes || r.internal_notes || ""
  };
}

router.get("/reservations", async (req, res, next) => {
  try {
    const probe = await booqableProbeReservations(1);

    if (!probe.ok) {
      console.error("[Booqable detector attempts]", probe.attempts);
      return res.status(404).json({ ok: false, error: "No reservations endpoint matched", attempts: probe.attempts });
    }

    const { base, path, auth } = probe;

    let page = 1, imported = 0;
    for (;;) {
      const data = await booqableGetKnown(base, path, auth, {}, 50, page);
      const list = extractList(data);
      if (!list.length) break;

      for (const raw of list) {
        const n = norm(raw);
        await Reservation.updateOne(
          { externalSystem: "booqable", externalId: n.externalId },
          { $set: { ...n, lastSyncedAt: new Date() } },
          { upsert: true }
        );
        imported++;
      }
      page++;
    }

    res.json({ ok: true, imported, base, endpoint: path, auth });
  } catch (e) { next(e); }
});

export default router;