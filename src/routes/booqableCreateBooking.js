import express from "express";
import { booqableProbeReservations } from "../integrations/booqableClient.js";
import fetch from "node-fetch";

const router = express.Router();

/** ---------- helpers ---------- */

function authHeaders() {
  const API_KEY = (process.env.BOOQABLE_API_KEY || "").trim();
  return [
    (h) => { h.Authorization = `Bearer ${API_KEY}`; },
    (h) => { h.Authorization = `Token ${API_KEY}`; },
    (h) => { h.Authorization = `Token token=${API_KEY}`; },
    (h) => { h["X-API-KEY"] = API_KEY; },
  ];
}

function makeUrl(base, path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const sep = path.startsWith("/") ? "" : "/";
  return `${base}${sep}${path}${qs ? `?${qs}` : ""}`;
}

const PRODUCT_PATHS = [
  "/products", "/products.json",
  "/v1/products", "/v1/products.json",
  "/api/1/products", "/api/1/products.json",
];

async function fetchProducts(base, AUTHS, limit = 200) {
  const attempts = [];
  for (const auth of AUTHS) {
    for (const path of PRODUCT_PATHS) {
      const url = makeUrl(base, path, { page: 1, per_page: limit, sort: "-updated_at" });
      const headers = { "Content-Type": "application/json" };
      auth(headers);
      try {
        const r = await fetch(url, { headers });
        const text = await r.text();
        if (!r.ok) { attempts.push({ path, status: r.status }); continue; }
        let json; try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
        const list =
          (Array.isArray(json.products) && json.products) ||
          (Array.isArray(json.items) && json.items) ||
          (Array.isArray(json.data) && json.data) ||
          (Array.isArray(json.results) && json.results) ||
          [];
        return { ok: true, products: list, endpoint: path };
      } catch (e) {
        attempts.push({ path, error: String(e) });
      }
    }
  }
  return { ok: false, attempts };
}

function indexProducts(list) {
  const byId = new Map();
  const byName = new Map();
  const bySku = new Map();
  for (const p of list) {
    const id  = p.id || p.uuid;
    const name = (p.name || p.title || "").trim();
    const sku  = (p.sku || p.code || "").trim();
    if (!id) continue;
    byId.set(id, p);
    if (name) byName.set(name.toLowerCase(), p);
    if (sku)  bySku.set(sku.toLowerCase(), p);
  }
  return { byId, byName, bySku };
}

function buildCreatePayloads(body) {
  const customer = body.customer || {};
  const startAt  = body.startAt || body.start || body.starts_at || null;
  const endAt    = body.endAt   || body.end   || body.ends_at   || null;
  const notes    = body.notes || "";

  return [
    { order:       { customer: { name: customer.name || "", email: customer.email || "", phone: customer.phone || "" }, starts_at: startAt, ends_at: endAt, notes } },
    { reservation: { customer: { name: customer.name || "", email: customer.email || "", phone: customer.phone || "" }, start_at:  startAt, end_at:  endAt,  notes } },
    { booking:     { customer: { name: customer.name || "", email: customer.email || "", phone: customer.phone || "" }, start_time:startAt, end_time:endAt, notes } },
  ];
}

function buildLineItemPayloads(orderId, item) {
  const qty = Number(item.quantity ?? item.qty ?? 1);
  const productId = item.productId;
  const title = item.name || item.title;

  return [
    { path: `/orders/${orderId}/order_lines`, body: { order_line: { product_id: productId, quantity: qty, title } } },
    { path: `/orders/${orderId}/lines`,       body: { line:       { product_id: productId, quantity: qty, title } } },
    { path: `/order_lines`, body: { order_line: { order_id: orderId, product_id: productId, quantity: qty, title } } },
    { path: `/lines`,       body: { line:       { order_id: orderId, product_id: productId, quantity: qty, title } } },
    { path: `/v1/orders/${orderId}/order_lines`, body: { order_line: { product_id: productId, quantity: qty, title } } },
    { path: `/v1/order_lines`,                   body: { order_line: { order_id: orderId, product_id: productId, quantity: qty, title } } },
  ];
}

/** ---------- main route ---------- */
/** POST /api/sync/booqable/bookings
 * Body:
 * {
 *   customer: { name, email, phone },
 *   startAt, endAt, notes,
 *   items: [
 *     { name: "Event Rental- 50 People", quantity: 2 }   // or
 *     { sku: "50_PERSON_PARTY_TRAILER",  quantity: 2 }   // or
 *     { productId: "uuid", quantity: 2 }                 // still supported
 *   ]
 * }
 */
router.post("/bookings", async (req, res, next) => {
  try {
    const probe = await booqableProbeReservations(1);
    if (!probe.ok) return res.status(400).json({ ok: false, error: "Could not detect Booqable API endpoint." });
    const { base } = probe;

    const AUTHS = authHeaders();

    // 0) If there are items by name/sku, resolve them to product IDs
    const itemsIn = Array.isArray(req.body.items) ? req.body.items : [];
    let resolver = null;
    if (itemsIn.some(i => !i.productId)) {
      const list = await fetchProducts(base, AUTHS, 300);
      if (!list.ok) return res.status(400).json({ ok: false, error: "Could not fetch products to resolve item names.", details: list.attempts });
      resolver = indexProducts(list.products);
      for (const it of itemsIn) {
        if (!it.productId) {
          let hit = null;
          if (it.sku)   hit = resolver.bySku.get(String(it.sku).toLowerCase());
          if (!hit && it.name) {
            // prefer exact case-insensitive match first
            hit = resolver.byName.get(String(it.name).toLowerCase());
            // fallback: loose contains search
            if (!hit) {
              const wanted = String(it.name).toLowerCase();
              for (const [n, p] of resolver.byName.entries()) {
                if (n.includes(wanted)) { hit = p; break; }
              }
            }
          }
          if (hit) {
            it.productId = hit.id || hit.uuid;
            if (!it.title && !it.name) it.name = hit.name || hit.title || "";
          }
        }
      }
      // if any unresolved remain, we’ll simply skip attaching those
    }

    // 1) Create the empty order/booking
    const createCandidates = [
      "/orders", "/orders.json",
      "/reservations", "/reservations.json",
      "/bookings", "/bookings.json",
      "/v1/orders", "/v1/orders.json",
      "/v1/reservations", "/v1/reservations.json",
      "/v1/bookings", "/v1/bookings.json",
    ];
    const payloads = buildCreatePayloads(req.body);

    let created = null, orderId = null;
    const createTried = [];

    outer: for (const auth of AUTHS) {
      for (const path of createCandidates) {
        for (const body of payloads) {
          const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
          const headers = { "Content-Type": "application/json" };
          auth(headers);
          const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
          const text = await resp.text();
          createTried.push({ path, status: resp.status, sample: text.slice(0, 200) });
          if (resp.ok) {
            try { created = text ? JSON.parse(text) : {}; } catch { created = { raw: text }; }
            orderId =
              created?.order?.id ||
              created?.reservation?.id ||
              created?.booking?.id ||
              created?.id || null;
            break outer;
          }
        }
      }
    }

    if (!created || !orderId) {
      return res.status(400).json({ ok: false, error: "Create failed (no endpoint accepted).", tried: createTried });
    }

    // 2) Attach resolved items
    const itemsResolved = itemsIn.filter(i => i.productId);
    let attached = 0;
    const itemAttempts = [];

    for (const it of itemsResolved) {
      const liCandidates = buildLineItemPayloads(orderId, it);
      let done = false;
      for (const auth of AUTHS) {
        for (const { path, body } of liCandidates) {
          const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
          const headers = { "Content-Type": "application/json" };
          auth(headers);
          const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
          const t = await r.text();
          itemAttempts.push({ path, status: r.status, sample: t.slice(0, 160) });
          if (r.ok) { attached++; done = true; break; }
        }
        if (done) break;
      }
    }

    const unresolved = itemsIn.length - itemsResolved.length;

    return res.json({
      ok: true,
      created, orderId,
      itemsRequested: itemsIn.length,
      itemsAttached: attached,
      itemsUnresolved: unresolved,
      attempts: { create: createTried.slice(0,5), items: itemAttempts.slice(0,5) }
    });
  } catch (e) { next(e); }
});

export default router;