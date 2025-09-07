import express from "express";
import { booqableProbeReservations } from "../integrations/booqableClient.js";
import fetch from "node-fetch";

const router = express.Router();

function authHeaders() {
  const API_KEY = (process.env.BOOQABLE_API_KEY || "").trim();
  return [
    (h) => { h.Authorization = `Bearer ${API_KEY}`; },
    (h) => { h.Authorization = `Token ${API_KEY}`; },
    (h) => { h.Authorization = `Token token=${API_KEY}`; },
    (h) => { h["X-API-KEY"] = API_KEY; },
  ];
}
const AUTHS = authHeaders();

function urlJoin(base, path) {
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Try to find a payment/checkout URL anywhere in an object
function findPaymentUrl(obj) {
  if (!obj || typeof obj !== "object") return null;
  const tryKeys = (o) => ([
    o.payment_url, o.checkout_url, o.public_url, o.hosted_invoice_url, o.url,
    o?.invoice?.payment_url, o?.invoice?.checkout_url, o?.invoice?.public_url, o?.invoice?.url,
    o?.links?.payment, o?.links?.checkout, o?.links?.public,
    o?.data?.payment_url, o?.data?.checkout_url, o?.data?.public_url, o?.data?.url
  ].filter(Boolean));

  const direct = tryKeys(obj);
  if (direct.length && /^https?:\/\//i.test(String(direct[0]))) return String(direct[0]);

  // Deep scan for first https URL
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

router.post("/invoices", async (req, res, next) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    if (!orderId) return res.status(400).json({ ok: false, error: "orderId is required" });

    const probe = await booqableProbeReservations(1);
    if (!probe.ok) return res.status(400).json({ ok: false, error: "Could not detect Booqable API base." });
    const { base } = probe;

    // 1) Try multiple creation flows that often return a link
    const createCandidates = [
      // Invoices (some accounts)
      { path: `/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
      { path: `/invoices`,                   body: { invoice: { order_id: orderId } } },
      { path: `/v1/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
      { path: `/v1/invoices`,                   body: { invoice: { order_id: orderId } } },
      { path: `/api/1/orders/${orderId}/invoices`, body: { invoice: { order_id: orderId } } },
      { path: `/api/1/invoices`,                  body: { invoice: { order_id: orderId } } },
      { path: `/orders/${orderId}/invoices.json`, body: { invoice: { order_id: orderId } } },
      { path: `/invoices.json`,                   body: { invoice: { order_id: orderId } } },

      // Checkouts (frequent)
      { path: `/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId } } },
      { path: `/checkouts`,                   body: { checkout: { order_id: orderId } } },
      { path: `/api/1/orders/${orderId}/checkouts`, body: { checkout: { order_id: orderId } } },
      { path: `/api/1/checkouts`,                 body: { checkout: { order_id: orderId } } },
      { path: `/orders/${orderId}/checkouts.json`, body: { checkout: { order_id: orderId } } },
      { path: `/checkouts.json`,                   body: { checkout: { order_id: orderId } } },

      // Payment links (some accounts)
      { path: `/orders/${orderId}/payment_links`, body: { payment_link: { order_id: orderId } } },
      { path: `/payment_links`,                   body: { payment_link: { order_id: orderId } } },
      { path: `/api/1/orders/${orderId}/payment_links`, body: { payment_link: { order_id: orderId } } },
      { path: `/api/1/payment_links`,                 body: { payment_link: { order_id: orderId } } },

      // Payments (if permitted)
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
        createTried.push({ path: cand.path, status: r.status, sample: text.slice(0, 200) });
        if (!r.ok) continue;

        try { createdJson = text ? JSON.parse(text) : {}; } catch { createdJson = { raw: text }; }
        paymentLink = findPaymentUrl(createdJson);
        if (paymentLink) break outer;
      }
    }

    // 2) If no link in creation response, try reading common resources to find one
    const fetchTried = [];
    if (!paymentLink) {
      const fetchCandidates = [
        // Invoices for order
        `/orders/${orderId}/invoices`,
        `/v1/orders/${orderId}/invoices`,
        `/api/1/orders/${orderId}/invoices`,
        `/invoices?order_id=${orderId}`,
        `/v1/invoices?order_id=${orderId}`,
        `/api/1/invoices?order_id=${orderId}`,
        // Checkouts/payment links lists
        `/orders/${orderId}/checkouts`,
        `/api/1/orders/${orderId}/checkouts`,
        `/checkouts?order_id=${orderId}`,
        `/api/1/checkouts?order_id=${orderId}`,
        `/orders/${orderId}/payment_links`,
        `/api/1/orders/${orderId}/payment_links`,
        `/payment_links?order_id=${orderId}`,
        `/api/1/payment_links?order_id=${orderId}`,
        // Finally the order itself (often contains a public/checkout URL)
        `/orders/${orderId}`,
        `/v1/orders/${orderId}`,
        `/api/1/orders/${orderId}`,
      ];
      for (const auth of AUTHS) {
        for (const path of fetchCandidates) {
          const url = urlJoin(base, path);
          const headers = {};
          auth(headers);
          const r = await fetch(url, { headers });
          const t = await r.text();
          fetchTried.push({ path, status: r.status, sample: t.slice(0, 200) });
          if (!r.ok) continue;
          let json; try { json = t ? JSON.parse(t) : {}; } catch { json = { raw: t }; }
          paymentLink = findPaymentUrl(json);
          if (paymentLink) break;
        }
        if (paymentLink) break;
      }
    }

    if (!createdJson && !paymentLink) {
      return res.status(400).json({ ok: false, error: "No invoice/checkout endpoint accepted.", tried: { create: createTried.slice(0,6) } });
    }

    return res.json({
      ok: true,
      invoiceCreated: !!createdJson,
      paymentLink: paymentLink || null,
      created: createdJson || null,
      tried: { create: createTried.slice(0,6), fetch: fetchTried.slice(0,6) }
    });
  } catch (e) { next(e); }
});

export default router;