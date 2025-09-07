import express from "express";
import { booqableProbeReservations } from "../integrations/booqableClient.js";
import fetch from "node-fetch";

const router = express.Router();

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

function urlJoin(base, path) {
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function findPaymentUrl(obj) {
  if (!obj || typeof obj !== "object") return null;
  const picks = [
    obj.payment_url, obj.checkout_url, obj.public_url, obj.hosted_invoice_url, obj.url,
    obj?.invoice?.payment_url, obj?.invoice?.checkout_url, obj?.invoice?.public_url, obj?.invoice?.url,
    obj?.links?.payment, obj?.links?.checkout, obj?.links?.public,
    obj?.data?.payment_url, obj?.data?.checkout_url, obj?.data?.public_url, obj?.data?.url,
  ].filter(Boolean);
  if (picks.length && /^https?:\/\//i.test(String(picks[0]))) return String(picks[0]);
  const stack = [obj];
  while (stack.length) {
    const it = stack.pop();
    if (it && typeof it === "object") {
      for (const k of Object.keys(it)) {
        const v = it[k];
        if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  return null;
}

/** Create/locate a payment link for an order */
async function getOrCreatePaymentLink(base, orderId) {
  const createCandidates = [
    // Invoices
    { path: `/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
    { path: `/invoices`,                   body: { invoice: { order_id: orderId } } },
    { path: `/v1/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
    { path: `/v1/invoices`,                   body: { invoice: { order_id: orderId } } },
    { path: `/api/1/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
    { path: `/api/1/invoices`,                  body: { invoice: { order_id: orderId } } },
    { path: `/orders/${orderId}/invoices.json`, body: { invoice: { order_id: orderId } } },
    { path: `/invoices.json`,                   body: { invoice: { order_id: orderId } } },
    // Checkouts (very common)
    { path: `/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId } } },
    { path: `/checkouts`,                   body: { checkout: { order_id: orderId } } },
    { path: `/api/1/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId } } },
    { path: `/api/1/checkouts`,                 body: { checkout: { order_id: orderId } } },
    { path: `/orders/${orderId}/checkouts.json`, body: { checkout: { order_id: orderId } } },
    { path: `/checkouts.json`,                   body: { checkout: { order_id: orderId } } },
    // Payment links
    { path: `/orders/${orderId}/payment_links`, body: { payment_link: { order_id: orderId } } },
    { path: `/payment_links`,                   body: { payment_link: { order_id: orderId } } },
    { path: `/api/1/orders/${orderId}/payment_links`, body: { payment_link: { order_id: orderId } } },
    { path: `/api/1/payment_links`,                 body: { payment_link: { order_id: orderId } } },
    // Payments (last resort)
    { path: `/orders/${orderId}/payments`, body: { payment: { order_id: orderId } } },
    { path: `/payments`,                   body: { payment: { order_id: orderId } } },
  ];

  const createTried = [];
  let createdJson = null, paymentLink = null;

  outer: for (const auth of AUTHS) {
    for (const cand of createCandidates) {
      const url = urlJoin(base, cand.path);
      const headers = { "Content-Type": "application/json" };
      auth(headers);
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(cand.body) });
      const text = await r.text();
      createTried.push({ path: cand.path, status: r.status, sample: text.slice(0, 160) });
      if (!r.ok) continue;
      try { createdJson = text ? JSON.parse(text) : {}; } catch { createdJson = { raw: text }; }
      paymentLink = findPaymentUrl(createdJson);
      if (paymentLink) break outer;
    }
  }

  // If still no link, try reading resources that might contain one
  const fetchTried = [];
  if (!paymentLink) {
    const fetchCandidates = [
      `/orders/${orderId}/invoices`, `/v1/orders/${orderId}/invoices`, `/api/1/orders/${orderId}/invoices`,
      `/invoices?order_id=${orderId}`, `/v1/invoices?order_id=${orderId}`, `/api/1/invoices?order_id=${orderId}`,
      `/orders/${orderId}/checkouts`, `/api/1/orders/${orderId}/checkouts`,
      `/checkouts?order_id=${orderId}`, `/api/1/checkouts?order_id=${orderId}`,
      `/orders/${orderId}/payment_links`, `/api/1/orders/${orderId}/payment_links`,
      `/payment_links?order_id=${orderId}`, `/api/1/payment_links?order_id=${orderId}`,
      `/orders/${orderId}`, `/v1/orders/${orderId}`, `/api/1/orders/${orderId}`,
    ];
    for (const auth of AUTHS) {
      for (const path of fetchCandidates) {
        const url = urlJoin(base, path);
        const headers = {};
        auth(headers);
        const r = await fetch(url, { headers });
        const t = await r.text();
        fetchTried.push({ path, status: r.status, sample: t.slice(0, 160) });
        if (!r.ok) continue;
        let json; try { json = t ? JSON.parse(t) : {}; } catch { json = { raw: t }; }
        paymentLink = findPaymentUrl(json);
        if (paymentLink) return { ok: true, paymentLink, tried: { create: createTried, fetch: fetchTried }, createdJson };
      }
    }
  }

  return { ok: !!paymentLink, paymentLink: paymentLink || null, tried: { create: createTried, fetch: [] }, createdJson };
}

async function fetchOrder(base, orderId) {
  const paths = [`/orders/${orderId}`, `/v1/orders/${orderId}`, `/api/1/orders/${orderId}`];
  for (const auth of AUTHS) {
    for (const p of paths) {
      const url = urlJoin(base, p);
      const headers = {};
      auth(headers);
      const r = await fetch(url, { headers });
      const t = await r.text();
      if (!r.ok) continue;
      try { return JSON.parse(t); } catch { return { raw: t }; }
    }
  }
  return null;
}

function centsToUSD(c) {
  const n = Number(c);
  if (!isFinite(n)) return null;
  return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function extractOrderFields(o) {
  const order = o?.order || o?.data || o || {};
  const number = order.number || order.id || "";
  const customerName =
    order?.customer?.name ||
    order?.customer_name ||
    "";
  const totalCents =
    order.grand_total_with_tax_in_cents ??
    order.grand_total_in_cents ??
    order.total_in_cents ??
    order.amount_in_cents ??
    null;
  const total = totalCents != null ? centsToUSD(totalCents) : null;
  return { number, customerName, total };
}

function buildEmail({ link, orderInfo, fallbackName }) {
  const { number, customerName, total } = orderInfo || {};
  const name = (fallbackName || customerName || "there").toString().trim();
  const subject = `Party Trailer – Invoice & Payment Link${number ? ` (#${number})` : ""}`;
  const lines = [
    `Hi ${name},`,
    "",
    "Thanks for booking with The Party Trailer!",
    total ? `Invoice total: ${total}` : "Here is your invoice & secure payment link:",
    link,
    "",
    "You can pay online in one click. If you have any questions or need changes, just reply to this email.",
    "",
    "— The Party Trailer",
  ];
  return { subject, body: lines.join("\n") };
}

/** POST /api/sync/booqable/paylink-email
 * body: { orderId: "<uuid>", customerName?: "optional override" }
 * returns: { ok, paymentLink, email:{subject, body}, created?, tried? }
 */
router.post("/paylink-email", async (req, res, next) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    const overrideName = req.body.customerName;
    if (!orderId) return res.status(400).json({ ok: false, error: "orderId is required" });

    const probe = await booqableProbeReservations(1);
    if (!probe.ok) return res.status(400).json({ ok: false, error: "Could not detect Booqable API base." });
    const { base } = probe;

    // 1) Get or create a payment link
    const linkResult = await getOrCreatePaymentLink(base, orderId);
    if (!linkResult.ok || !linkResult.paymentLink) {
      return res.status(400).json({ ok: false, error: "Could not obtain payment link.", tried: linkResult.tried });
    }

    // 2) Fetch order info to personalize the email
    const orderJson = await fetchOrder(base, orderId);
    const orderInfo = extractOrderFields(orderJson);

    // 3) Build email
    const email = buildEmail({ link: linkResult.paymentLink, orderInfo, fallbackName: overrideName });

    return res.json({
      ok: true,
      paymentLink: linkResult.paymentLink,
      email,
      created: linkResult.createdJson ? true : false,
      tried: { create: (linkResult.tried?.create || []).slice(0,5), fetch: (linkResult.tried?.fetch || []).slice(0,5) }
    });
  } catch (e) { next(e); }
});

export default router;
