import express from "express";
const router = express.Router();

function getPublicBase(req) {
  const fromEnv = (process.env.PUBLIC_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/,"");
  const host = req.get("host");
  const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

/**
 * GET /api/calendar/links
 * Optional query params (e.g. ?v=timestamp) are passed through to the ICS URL so you can bust caches.
 * Returns: { ok, baseUsed, choiceUrl, googleUrl, appleUrl, icsUrl }
 */
router.get("/links", (req, res) => {
  const base = getPublicBase(req);

  // pass-through any query params (e.g. v=123)
  const pass = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    pass.set(k, String(v));
  }

  const query = pass.toString();
  const icsUrl   = query ? `${base}/api/calendar.ics?${query}` : `${base}/api/calendar.ics`;
  const choice   = query ? `${base}/api/calendar/subscribe?${query}` : `${base}/api/calendar/subscribe`;
  const google   = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icsUrl)}`;
  const apple    = `webcal://${base.replace(/^https?:\/\//, "")}/api/calendar.ics${query ? "?" + query : ""}`;

  res.json({
    ok: true,
    baseUsed: base,
    choiceUrl: choice,
    googleUrl: google,
    appleUrl: apple,
    icsUrl: icsUrl,
  });
});

export default router;
