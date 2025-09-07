import fetch from "node-fetch";

const API_KEY = (process.env.BOOQABLE_API_KEY || "").trim();
const SUB     = (process.env.BOOQABLE_ACCOUNT_SUBDOMAIN || "").trim();

// Build base URL candidates
const baseCandidates = [
  "https://api.booqable.com",               // some accounts
  "https://app.booqable.com/api/1",         // others
  SUB ? `https://${SUB}.booqable.com/api/1` : null,  // most common per-account API
].filter(Boolean);

// Auth/header/query variants to try
const authVariants = [
  { name: "Bearer",   header: (h) => { h.Authorization = `Bearer ${API_KEY}`; } },
  { name: "Token",    header: (h) => { h.Authorization = `Token ${API_KEY}`; } },
  { name: "TokenKV",  header: (h) => { h.Authorization = `Token token=${API_KEY}`; } },
  { name: "X-Api-Key",header: (h) => { h["X-API-KEY"] = API_KEY; } },
  { name: "q_token",  query:  (q) => q.set("token", API_KEY) },
  { name: "q_api_key",query:  (q) => q.set("api_key", API_KEY) },
];

// Paths to test for reservations
const pathCandidates = [
  "/orders", "/orders.json",
  "/reservations", "/reservations.json",
  "/bookings", "/bookings.json",
  "/v1/orders", "/v1/orders.json",
  "/v1/reservations", "/v1/reservations.json",
  "/v1/bookings", "/v1/bookings.json"
];

function makeUrl(base, path, params = {}, queryMutator) {
  const qs = new URLSearchParams(params);
  if (queryMutator) queryMutator(qs);
  const sep = path.startsWith("/") ? "" : "/";
  const s = qs.toString();
  return `${base}${sep}${path}${s ? `?${s}` : ""}`;
}

function makeHeaders(mutator) {
  const h = { "Content-Type": "application/json" };
  if (mutator) mutator(h);
  return h;
}

// Probe through combinations until something returns 200 OK
export async function booqableProbeReservations(page = 1) {
  const attempts = [];
  for (const base of baseCandidates) {
    for (const auth of authVariants) {
      for (const path of pathCandidates) {
        if (!API_KEY && (auth.name !== "none")) continue; // no key present
        const url = makeUrl(base, path, { page, per_page: 1, sort: "-updated_at" }, auth.query);
        const headers = makeHeaders(auth.header);
        try {
          const res = await fetch(url, { headers });
          const text = await res.text();
          attempts.push({ base, path, auth: auth.name, status: res.status, sample: text.slice(0,160) });
          if (res.ok) {
            let json; try { json = text ? JSON.parse(text) : undefined; } catch {}
            return { ok: true, base, path, auth: auth.name, json, text, attempts };
          }
        } catch (e) {
          attempts.push({ base, path, auth: auth.name, error: String(e) });
        }
      }
    }
  }
  return { ok: false, attempts };
}

export async function booqableGetKnown(base, path, authName, params = {}, perPage = 50, page = 1) {
  const auth = authVariants.find(a => a.name === authName);
  const url = makeUrl(base, path, { ...params, page, per_page: perPage, sort: "-updated_at" }, auth?.query);
  const headers = makeHeaders(auth?.header);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Booqable GET ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Back-compat for existing inventory import (will use first base + Bearer)
export async function booqableGet(path, params = {}) {
  const base = baseCandidates[0];
  const url = makeUrl(base, path, params);
  const headers = makeHeaders(h => { h.Authorization = `Bearer ${API_KEY}`; });
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Booqable GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}