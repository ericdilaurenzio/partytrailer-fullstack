import express from "express";
import { booqableProbeReservations } from "../integrations/booqableClient.js";
import fetch from "node-fetch";

const router = express.Router();

/* ---------- shared helpers ---------- */
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
const PRODUCT_PATHS = [
  "/products", "/products.json",
  "/v1/products", "/v1/products.json",
  "/api/1/products", "/api/1/products.json",
];
const CUSTOMER_FIND_PATHS = [
  // list/search variants
  (email) => `/customers?email=${encodeURIComponent(email)}`,
  (email) => `/v1/customers?email=${encodeURIComponent(email)}`,
  (email) => `/api/1/customers?email=${encodeURIComponent(email)}`,
  (email) => `/customers.json?email=${encodeURIComponent(email)}`,
  // generic list (we'll filter client-side)
  () => `/customers`, () => `/v1/customers`, () => `/api/1/customers`,
];
const CUSTOMER_CREATE_PATHS = [
  `/customers`, `/v1/customers`, `/api/1/customers`, `/customers.json`,
];
function urlJoin(base, path) { return `${base}${path.startsWith("/") ? "" : "/"}${path}`; }

function makeUrl(base, path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return urlJoin(base, `${path}${qs ? `?${qs}` : ""}`);
}
function pickProductFields(p) {
  return { id: p.id || p.uuid, name: p.name || p.title, sku: p.sku || p.code || "" };
}
function indexProducts(list) {
  const byName = new Map(), bySku = new Map();
  for (const p of list) {
    const name = (p.name || p.title || "").trim().toLowerCase();
    const sku  = (p.sku || p.code  || "").trim().toLowerCase();
    if (name) byName.set(name, p);
    if (sku)  bySku.set(sku, p);
  }
  return { byName, bySku };
}
async function fetchProducts(base) {
  for (const auth of AUTHS) {
    for (const path of PRODUCT_PATHS) {
      const url = makeUrl(base, path, { page: 1, per_page: 300, sort: "-updated_at" });
      const headers = { "Content-Type": "application/json" }; auth(headers);
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const t = await r.text(); let j={}; try{j=JSON.parse(t)}catch{}
      const list = j.products || j.items || j.data || j.results || [];
      if (Array.isArray(list) && list.length) return list.map(pickProductFields);
    }
  }
  return [];
}
function resolveItemsByNameOrSku(items, index) {
  const resolved = [];
  for (const it of items) {
    const qty = Number(it.quantity ?? it.qty ?? 1);
    let product = null;
    if (it.sku)  product = index.bySku.get(String(it.sku).toLowerCase());
    if (!product && it.name) {
      const key = String(it.name).toLowerCase();
      product = index.byName.get(key);
      if (!product) { // loose contains
        for (const [n,p] of index.byName.entries()) { if (n.includes(key)) { product = p; break; } }
      }
    }
    if (product?.id) resolved.push({ productId: product.id, quantity: qty, title: product.name });
  }
  return resolved;
}
function buildCreatePayloads(body, customerId) {
  const startAt = body.startAt || body.start || body.starts_at || null;
  const endAt   = body.endAt   || body.end   || body.ends_at   || null;
  const notes   = body.notes || "";
  const customer = body.customer || {};
  const custObj = customerId ? { id: customerId } : { name: customer.name||"", email: customer.email||"", phone: customer.phone||"" };

  return [
    { order:       { customer: custObj, starts_at: startAt, ends_at: endAt, notes } },
    { reservation: { customer: custObj, start_at:  startAt, end_at:  endAt,  notes } },
    { booking:     { customer: custObj, start_time:startAt, end_time:endAt, notes } },
  ];
}
function buildLineItemPayloads(orderId, item) {
  const qty = Number(item.quantity ?? 1);
  const productId = item.productId;
  const title = item.title || item.name;
  return [
    { path: `/orders/${orderId}/order_lines`, body: { order_line: { product_id: productId, quantity: qty, title } } },
    { path: `/orders/${orderId}/lines`,       body: { line:       { product_id: productId, quantity: qty, title } } },
    { path: `/order_lines`,                   body: { order_line: { order_id: orderId, product_id: productId, quantity: qty, title } } },
    { path: `/lines`,                         body: { line:       { order_id: orderId, product_id: productId, quantity: qty, title } } },
    { path: `/v1/orders/${orderId}/order_lines`, body: { order_line: { product_id: productId, quantity: qty, title } } },
    { path: `/v1/order_lines`,                   body: { order_line: { order_id: orderId, product_id: productId, quantity: qty, title } } },
  ];
}
function centsToUSD(c) {
  const n = Number(c);
  if (!isFinite(n)) return null;
  return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function findPaymentUrl(obj) {
  if (!obj || typeof obj !== "object") return null;
  const direct = [
    obj.payment_url, obj.checkout_url, obj.public_url, obj.hosted_invoice_url, obj.url,
    obj?.invoice?.payment_url, obj?.invoice?.checkout_url, obj?.invoice?.public_url, obj?.invoice?.url,
    obj?.links?.payment, obj?.links?.checkout, obj?.links?.public,
    obj?.data?.payment_url, obj?.data?.checkout_url, obj?.data?.public_url, obj?.data?.url,
  ].filter(Boolean);
  if (direct.length && /^https?:\/\//i.test(String(direct[0]))) return String(direct[0]);
  const stack=[obj]; while(stack.length){ const it=stack.pop(); if(it&&typeof it==="object"){ for(const k of Object.keys(it)){ const v=it[k]; if(typeof v==="string" && /^https?:\/\//i.test(v)) return v; if(v&&typeof v==="object") stack.push(v); } } }
  return null;
}
function buildEmail({ link, order, overrideName }) {
  const number = order?.number || order?.id || "";
  const name = (overrideName || order?.customer?.name || "there").toString().trim();
  const totalCents = order?.grand_total_with_tax_in_cents ?? order?.grand_total_in_cents ?? order?.total_in_cents ?? order?.amount_in_cents ?? null;
  const total = totalCents != null ? centsToUSD(totalCents) : null;

  const subject = `Party Trailer - Invoice & Payment Link${number ? ` (#${number})` : ""}`;
  const lines = [
    `Hi ${name},`,
    "",
    "Thanks for booking with The Party Trailer!",
  ];
  if (total && !/^\$?0(\.00)?$/.test(total)) lines.push(`Invoice total: ${total}`);
  else lines.push("Here is your secure payment link:");
  lines.push(
    link,
    "",
    "You can pay online in one click. If you have any questions or need changes, just reply to this email.",
    "",
    "-- The Party Trailer"
  );
  return { subject, body: lines.join("\n") };
}

/* ---------- Booqable ops ---------- */
async function findOrCreateCustomer(base, customer) {
  const email = (customer?.email || "").trim();
  const name  = (customer?.name  || "").trim();
  const phone = (customer?.phone || "").trim();

  // try find by email
  if (email) {
    for (const auth of AUTHS) {
      for (const mk of CUSTOMER_FIND_PATHS) {
        const path = mk(email);
        const url = urlJoin(base, path);
        const headers = {}; auth(headers);
        const r = await fetch(url, { headers });
        if (!r.ok) continue;
        let j={}; try{ j = await r.json(); } catch {}
        const arr = j.customers || j.items || j.data || j.results || [];
        const hit = Array.isArray(arr) ? arr.find(c => (c.email||"").toLowerCase() === email.toLowerCase()) : null;
        if (hit?.id) return { id: hit.id, existing: true, raw: hit };
      }
    }
  }

  // create new
  for (const auth of AUTHS) {
    for (const path of CUSTOMER_CREATE_PATHS) {
      const url = urlJoin(base, path);
      const headers = { "Content-Type": "application/json" }; auth(headers);
      const body = { customer: { name, email, phone } };
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) continue;
      const t = await r.text(); let j={}; try{ j = JSON.parse(t) } catch { j = { raw: t } }
      const c = j.customer || j.data || j;
      if (c?.id) return { id: c.id, created: true, raw: c };
    }
  }
  // fallback: anonymous (API may still accept order with inline customer fields)
  return { id: null, created: false, existing: false };
}

async function createOrder(base, body, customerId) {
  const candidates = ["/orders","/orders.json","/reservations","/reservations.json","/bookings","/bookings.json","/v1/orders","/v1/orders.json","/v1/reservations","/v1/reservations.json","/v1/bookings","/v1/bookings.json"];
  const payloads = buildCreatePayloads(body, customerId);
  for (const auth of AUTHS) {
    for (const path of candidates) {
      for (const p of payloads) {
        const url = urlJoin(base, path);
        const headers = { "Content-Type": "application/json" }; auth(headers);
        const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(p) });
        const t = await r.text();
        if (!r.ok) continue;
        let j={}; try{ j = t ? JSON.parse(t) : {} } catch { j = { raw: t } }
        const order =
          j.order || j.reservation || j.booking || j;
        const orderId = order?.id || j?.id || null;
        if (orderId) return { orderId, wrapper: j, order };
      }
    }
  }
  return { orderId: null };
}

async function attachItems(base, orderId, items) {
  let attached = 0;
  for (const it of items) {
    const cands = buildLineItemPayloads(orderId, it);
    let done = false;
    for (const auth of AUTHS) {
      for (const { path, body } of cands) {
        const url = urlJoin(base, path);
        const headers = { "Content-Type": "application/json" }; auth(headers);
        const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        if (r.ok) { attached++; done = true; break; }
      }
      if (done) break;
    }
  }
  return attached;
}

async function getPaymentLink(base, orderId) {
  const createCands = [
    { path: `/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
    { path: `/invoices`,                   body: { invoice: { order_id: orderId } } },
    { path: `/v1/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
    { path: `/v1/invoices`,                   body: { invoice: { order_id: orderId } } },
    { path: `/api/1/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
    { path: `/api/1/invoices`,                  body: { invoice: { order_id: orderId } } },
    { path: `/orders/${orderId}/invoices.json`, body: { invoice: { order_id: orderId } } },
    { path: `/invoices.json`,                   body: { invoice: { order_id: orderId } } },
    { path: `/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId } } },
    { path: `/checkouts`,                   body: { checkout: { order_id: orderId } } },
    { path: `/api/1/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId } } },
    { path: `/api/1/checkouts`,                 body: { checkout: { order_id: orderId } } },
    { path: `/orders/${orderId}/checkouts.json`, body: { checkout: { order_id: orderId } } },
    { path: `/checkouts.json`,                   body: { checkout: { order_id: orderId } } },
    { path: `/orders/${orderId}/payment_links`, body: { payment_link: { order_id: orderId } } },
    { path: `/payment_links`,                   body: { payment_link: { order_id: orderId } } },
    { path: `/api/1/orders/${orderId}/payment_links`, body: { payment_link: { order_id: orderId } } },
    { path: `/api/1/payment_links`,                 body: { payment_link: { order_id: orderId } } },
  ];
  for (const auth of AUTHS) {
    for (const cand of createCands) {
      const url = urlJoin(base, cand.path);
      const headers = { "Content-Type": "application/json" }; auth(headers);
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(cand.body) });
      const t = await r.text(); let j={}; try{ j = t ? JSON.parse(t) : {} } catch { j = { raw: t } }
      const link = findPaymentUrl(j);
      if (r.ok && link) return link;
    }
  }
  // fallback: read order/checkouts for a public/checkout URL
  const getCands = [
    `/orders/${orderId}`, `/v1/orders/${orderId}`, `/api/1/orders/${orderId}`,
    `/orders/${orderId}/checkouts`, `/api/1/orders/${orderId}/checkouts`,
  ];
  for (const auth of AUTHS) {
    for (const p of getCands) {
      const url = urlJoin(base, p);
      const headers = {}; auth(headers);
      const r = await fetch(url, { headers });
      const t = await r.text(); let j={}; try{ j = t ? JSON.parse(t) : {} } catch { j = { raw: t } }
      const link = findPaymentUrl(j);
      if (r.ok && link) return link;
    }
  }
  return null;
}

/* ---------- endpoint ---------- */
/** POST /api/booking/create-with-paylink
 * Body:
 * {
 *   customer: { name, email, phone },
 *   startAt, endAt, notes,
 *   items: [{ name: "White Folding Chair", quantity: 4 }, { sku: "CHAIR", quantity: 2 }]
 * }
 */
router.post("/booking/create-with-paylink", async (req, res, next) => {
  try {
    const probe = await booqableProbeReservations(1);
    if (!probe.ok) return res.status(400).json({ ok:false, error:"Could not detect Booqable API base." });
    const { base } = probe;

    // 1) Customer: find or create (by email if provided)
    const customerInput = req.body.customer || {};
    const customerResult = await findOrCreateCustomer(base, customerInput);

    // 2) Create order/booking (include customerId if we have it)
    const orderResult = await createOrder(base, req.body, customerResult.id);
    if (!orderResult.orderId) return res.status(400).json({ ok:false, error:"Failed to create order/booking." });
    const orderId = orderResult.orderId;

    // 3) Items: resolve by name/sku, attach
    const itemsIn = Array.isArray(req.body.items) ? req.body.items : [];
    let itemsAttached = 0, itemsRequested = itemsIn.length, itemsUnresolved = 0;
    if (itemsIn.length) {
      const products = await fetchProducts(base);
      const idx = indexProducts(products);
      const resolved = resolveItemsByNameOrSku(itemsIn, idx);
      itemsUnresolved = Math.max(0, itemsIn.length - resolved.length);
      itemsAttached = await attachItems(base, orderId, resolved);
    }

    // 4) Payment link
    const paymentLink = await getPaymentLink(base, orderId);

    // 5) Build email
    const order = orderResult.order; // may already include totals/customer/number
    const email = buildEmail({ link: paymentLink || "Payment link unavailable", order, overrideName: customerInput.name });

    return res.json({
      ok: true,
      orderId,
      customer: { reused: !!customerResult.existing, created: !!customerResult.created, id: customerResult.id },
      itemsRequested, itemsAttached, itemsUnresolved,
      paymentLink: paymentLink || null,
      email
    });
  } catch (e) { next(e); }
});

export default router;