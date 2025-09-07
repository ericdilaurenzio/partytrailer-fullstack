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
 * GET /api/calendar/share-email
 * Optional: ?to=email@example.com&v=timestamp
 * Returns: { ok, subject, body, mailto }
 */
router.get("/share-email", (req, res) => {
  const base = getPublicBase(req);

  // pass-through for cache busting, etc.
  const pass = new URLSearchParams();
  for (const [k,v] of Object.entries(req.query || {})) {
    if (k !== "to") pass.set(k, String(v));
  }
  const q = pass.toString();
  const ics     = q ? `${base}/api/calendar.ics?${q}` : `${base}/api/calendar.ics`;
  const choice  = q ? `${base}/api/calendar/subscribe?${q}` : `${base}/api/calendar/subscribe`;
  const google  = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(ics)}`;
  const apple   = `webcal://${base.replace(/^https?:\/\//,"")}/api/calendar.ics${q ? "?" + q : ""}`;

  const subject = "Subscribe to Party Trailer calendar";
  const body = [
    "Hi,",
    "",
    "Choose your calendar app to subscribe:",
    `Google Calendar: ${google}`,
    `Apple Calendar:  ${apple}`,
    "",
    "If you prefer, you can import the ICS directly:",
    ics,
    "",
    "Thanks!",
    "- The Party Trailer"
  ].join("\r\n");

  const to = (req.query.to || "").toString().trim();
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  res.json({ ok: true, subject, body, mailto, links: { choice, google, apple, ics } });
});

export default router;
