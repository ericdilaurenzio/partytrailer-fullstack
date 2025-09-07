import express from "express";
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

function makeUrl(base, path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const sep = path.startsWith("/") ? "" : "/";
  return `${base}${sep}${path}${qs ? `?${qs}` : ""}`;
}

// Try common bases and paths for products
function baseCandidates() {
  const sub = (process.env.BOOQABLE_ACCOUNT_SUBDOMAIN || "").trim();
  const arr = ["https://api.booqable.com", "https://app.booqable.com/api/1"];
  if (sub) arr.unshift(`https://${sub}.booqable.com/api/1`);
  return arr;
}
const PRODUCT_PATHS = [
  "/products", "/products.json",
  "/v1/products", "/v1/products.json",
  "/api/1/products", "/api/1/products.json",
];

function pickFields(p) {
  return {
    id: p.id || p.uuid,
    name: p.name || p.title,
    sku: p.sku || p.code || "",
  };
}

router.get("/products", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 25), 100);
  const qName = (req.query.q || "").trim(); // optional name filter

  const bases = baseCandidates();
  const AUTHS = authHeaders();
  const attempts = [];

  for (const base of bases) {
    for (const auth of AUTHS) {
      for (const path of PRODUCT_PATHS) {
        const url = makeUrl(base, path, { page: 1, per_page: limit, sort: "-updated_at" });
        const headers = { "Content-Type": "application/json" };
        auth(headers);
        try {
          const r = await fetch(url, { headers });
          const text = await r.text();
          attempts.push({ base, path, status: r.status });
          if (!r.ok) continue;
          let json; try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }

          const list =
            (Array.isArray(json.products) && json.products) ||
            (Array.isArray(json.items) && json.items) ||
            (Array.isArray(json.data) && json.data) ||
            (Array.isArray(json.results) && json.results) ||
            [];

          const rows = list.map(pickFields).filter(x => x.id);
          const filtered = qName ? rows.filter(r => (r.name||"").toLowerCase().includes(qName.toLowerCase())) : rows;

          return res.json({ ok: true, base, endpoint: path, count: filtered.length, products: filtered });
        } catch (e) {
          attempts.push({ base, path, error: String(e) });
        }
      }
    }
  }

  return res.status(404).json({ ok: false, error: "Could not list products", attempts });
});

export default router;