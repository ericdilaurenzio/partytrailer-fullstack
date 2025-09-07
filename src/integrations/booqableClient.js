import fetch from "node-fetch";

const base = process.env.BOOQABLE_API_BASE_URL || "https://api.booqable.com";
const key  = process.env.BOOQABLE_API_KEY || "";

function headers() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`
  };
}

export async function booqableGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Booqable GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}