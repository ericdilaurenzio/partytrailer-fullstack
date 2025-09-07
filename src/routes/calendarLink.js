import express from "express";

const router = express.Router();

/**
 * GET /api/calendar/link
 * Query:
 *   includeHolds=1|0, includeBookings=1|0, from, to
 *   redirect=1  (302 to webcal/http)
 *   type=webcal|http
 *   mailto=you@example.com  (returns a mailto: with links in body)
 *
 * Uses PUBLIC_BASE_URL if set; else http://localhost:PORT
 */
router.get("/calendar/link", (req, res) => {
  const port = process.env.PORT || 5000;
  const base = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/,"");

  const qs = new URLSearchParams();
  if (String(req.query.includeHolds ?? "1") === "0")    qs.set("includeHolds","0");
  if (String(req.query.includeBookings ?? "1") === "0") qs.set("includeBookings","0");
  if (req.query.from) qs.set("from", String(req.query.from));
  if (req.query.to)   qs.set("to",   String(req.query.to));

  const httpUrl   = `${base}/api/calendar.ics${qs.toString() ? "?" + qs.toString() : ""}`;
  const webcalUrl = httpUrl.replace(/^https?/i, "webcal");

  const result = { ok:true, httpUrl, webcalUrl, baseUsed: base };

  // Optional mailto compose URL
  const to = req.query.mailto ? String(req.query.mailto) : "";
  if (to) {
    const subject = encodeURIComponent("Party Trailer — Calendar Subscription");
    const body = encodeURIComponent(
      `Subscribe to our calendar:\n\nWeb (HTTP): ${httpUrl}\nCalendar (WEBCAL): ${webcalUrl}\n\nTip: On iPhone/macOS, tap the webcal link to add it to Calendar.`
    );
    result.mailto = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  // Optional redirect to open immediately
  const wantsRedirect = ["1","true","yes"].includes(String(req.query.redirect||"").toLowerCase());
  if (wantsRedirect) {
    const type = String(req.query.type||"webcal").toLowerCase();
    const target = (type === "http") ? httpUrl : webcalUrl;
    return res.redirect(target);
  }

  return res.json(result);
});

export default router;