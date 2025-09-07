import express from "express";
const router = express.Router();

// Figure out the public base URL (Cloudflare/Ngrok) or fall back to request host.
function getPublicBase(req) {
  const fromEnv = (process.env.PUBLIC_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/,"");
  const host = req.get("host");
  const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

// GET /api/calendar/subscribe
// ?platform=android|ios|choose (default = choose)
// Any other query params (e.g. v=123) are passed through to the ICS URL.
router.get("/subscribe", (req, res) => {
  const base = getPublicBase(req);

  // pass-through params (except 'platform')
  const pass = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k !== "platform") pass.set(k, String(v));
  }

  const icsFull = pass.toString()
    ? `${base}/api/calendar.ics?${pass.toString()}`
    : `${base}/api/calendar.ics`;

  const platform = String(req.query.platform || "choose").toLowerCase();

  if (platform === "android" || platform === "google" || platform === "gcal") {
    const googleTarget = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icsFull)}`;
    return res.redirect(302, googleTarget);
  }

  if (platform === "ios" || platform === "apple" || platform === "iphone") {
    const appleUrl = `webcal://${base.replace(/^https?:\/\//, "")}/api/calendar.ics${pass.toString() ? "?" + pass.toString() : ""}`;
    return res.redirect(302, appleUrl);
  }

  // Choice page (default)
  const googleUrl = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icsFull)}`;
  const appleUrl  = `webcal://${base.replace(/^https?:\/\//, "")}/api/calendar.ics${pass.toString() ? "?" + pass.toString() : ""}`;

  res.set("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!doctype html>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Add Calendar</title>
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;background:#0B0C10;color:#fff;min-height:100vh">
  <h1 style="margin:0 0 8px 0;">Subscribe to Party Trailer</h1>
  <p style="color:#9aa0a6; margin:0 0 16px 0;">Choose your calendar app:</p>
  <p><a style="color:#60a5fa" href="${googleUrl}">Add to Google Calendar</a></p>
  <p><a style="color:#60a5fa" href="${appleUrl}">Add to Apple Calendar</a></p>
  <hr style="border-color:#1f2937; margin:16px 0">
  <p style="color:#9aa0a6">Direct ICS: <a style="color:#60a5fa" href="${icsFull}">${icsFull}</a></p>
</div>`);
});

export default router;
