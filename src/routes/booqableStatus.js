import express from "express";
import fetch from "node-fetch";
import { booqableProbeReservations } from "../integrations/booqableClient.js";

const router = express.Router();

/* ------------ helpers ------------ */
function authVariants() {
  const API_KEY = (process.env.BOOQABLE_API_KEY || "").trim();
  return [
    (h) => { h.Authorization = `Bearer ${API_KEY}`; },
    (h) => { h.Authorization = `Token ${API_KEY}`; },
    (h) => { h.Authorization = `Token token=${API_KEY}`; },
    (h) => { h["X-API-KEY"] = API_KEY; },
  ];
}
const AUTHS = authVariants();
const enc = encodeURIComponent;
const join = (base, path) => `${base}${path.startsWith("/") ? "" : "/"}${path}`;

/* Try POST a payment (amount in cents) using common Booqable shapes */
async function postPayment(base, orderId, amountCents, note, currency) {
  const candidates = [
    { path: `/orders/${orderId}/payments`, body: { payment: { order_id: orderId, amount_in_cents: amountCents, currency, note } } },
    { path: `/orders/${orderId}/payments`, body: { payment: { amount_in_cents: amountCents, currency, note } } },
    { path: `/payments`, body: { payment: { order_id: orderId, amount_in_cents: amountCents, currency, note } } },
    { path: `/payments`, body: { payment: { order_id: orderId, amount_cents: amountCents, currency, note } } },
    { path: `/api/1/orders/${orderId}/payments`, body: { payment: { order_id: orderId, amount_in_cents: amountCents, currency, note } } },
    { path: `/api/1/payments`, body: { payment: { order_id: orderId, amount_in_cents: amountCents, currency, note } } },
    // Some accounts allow quick capture via checkouts
    { path: `/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId, note } } },
    { path: `/api/1/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId, note } } },
  ];

  const tried = [];
  for (const auth of AUTHS) {
    for (const cand of candidates) {
      const url = join(base, cand.path);
      const headers = { "Content-Type": "application/json" }; auth(headers);
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(cand.body) });
      const t = await r.text();
      tried.push({ path: cand.path, status: r.status, sample: t.slice(0, 200) });
      if (!r.ok) continue;
      let json; try { json = t ? JSON.parse(t) : {}; } catch { json = { raw: t }; }
      return { ok: true, json, tried };
    }
  }
  return { ok: false, tried };
}

/* Try to mark confirmed/reserved via PATCH/PUT to orders/reservations */
async function patchStatus(base, orderId, status) {
  const bodies = [
    { order: { status } },
    { order: { statuses: [status] } },
    { reservation: { status } },
    { booking: { status } },
  ];
  const paths = [
    `/orders/${orderId}`, `/v1/orders/${orderId}`, `/api/1/orders/${orderId}`,
    `/reservations/${orderId}`, `/v1/reservations/${orderId}`, `/api/1/reservations/${orderId}`,
    `/bookings/${orderId}`, `/v1/bookings/${orderId}`, `/api/1/bookings/${orderId}`,
  ];

  const tried = [];
  for (const auth of AUTHS) {
    for (const p of paths) {
      for (const b of bodies) {
        const url = join(base, p);
        const headers = { "Content-Type": "application/json" }; auth(headers);
        const r = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(b) });
        const t = await r.text();
        tried.push({ path: p, method: "PATCH", body: b, status: r.status, sample: t.slice(0, 200) });
        if (r.ok) { let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; } return { ok: true, json: j, tried }; }

        // Some deployments only allow PUT
        const r2 = await fetch(url, { method: "PUT", headers, body: JSON.stringify(b) });
        const t2 = await r2.text();
        tried.push({ path: p, method: "PUT", body: b, status: r2.status, sample: t2.slice(0, 200) });
        if (r2.ok) { let j2; try { j2 = t2 ? JSON.parse(t2) : {}; } catch { j2 = { raw: t2 }; } return { ok: true, json: j2, tried }; }
      }
    }
  }
  return { ok: false, tried };
}

/* ------------ routes ------------ */

/** POST /api/booking/mark-paid
 * body: { orderId: "<uuid>", amount: 50.00, note?: "Paid via X", currency?: "USD" }
 * amount can be number dollars or integer cents; we normalize to cents.
 */
router.post("/mark-paid", async (req, res, next) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    if (!orderId) return res.status(400).json({ ok:false, error:"orderId is required" });

    let amount = req.body.amount;
    if (amount == null) return res.status(400).json({ ok:false, error:"amount is required" });

    // Normalize to cents
    let cents = Number.isInteger(amount) ? Number(amount) : Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ ok:false, error:"amount must be > 0" });

    const note = (req.body.note || "").toString();
    const currency = (req.body.currency || "USD").toString().toLowerCase();

    const probe = await booqableProbeReservations(1);
    if (!probe.ok) return res.status(400).json({ ok:false, error:"Could not detect Booqable API base." });
    const { base } = probe;

    const sent = await postPayment(base, orderId, cents, note, currency);
    if (!sent.ok) return res.status(400).json({ ok:false, error:"Booqable payment did not accept.", tried: sent.tried });

    return res.json({ ok:true, orderId, amountCents:cents, currency, receipt: sent.json, tried: sent.tried.slice(0,6) });
  } catch (e) { next(e); }
});

/** POST /api/booking/mark-confirmed
 * body: { orderId:"<uuid>", status?: "reserved" }
 * default status = "reserved"
 */
router.post("/mark-confirmed", async (req, res, next) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    if (!orderId) return res.status(400).json({ ok:false, error:"orderId is required" });

    const status = (req.body.status || "reserved").toString();
    const probe = await booqableProbeReservations(1);
    if (!probe.ok) return res.status(400).json({ ok:false, error:"Could not detect Booqable API base." });
    const { base } = probe;

    const patched = await patchStatus(base, orderId, status);
    if (!patched.ok) return res.status(400).json({ ok:false, error:"Could not update status in Booqable.", tried: patched.tried });

    return res.json({ ok:true, orderId, newStatus: status, result: patched.json, tried: patched.tried.slice(0,6) });
  } catch (e) { next(e); }
});

export default router;