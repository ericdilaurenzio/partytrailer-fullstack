import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/**
 * GET /api/utils/mailto
 * Query:
 *   to            (email)  - REQUIRED to open your mail client, optional if you only want the URL back
 *   subject       (string) - optional; if missing and orderId is given, will be generated
 *   body          (string) - optional; if missing and orderId is given, will be generated
 *   orderId       (uuid)   - optional; if provided, we’ll fetch subject/body via /api/sync/booqable/paylink-email
 *   customerName  (string) - optional; forwarded to paylink-email for personalization
 *   redirect      (1/true) - optional; if set, we 302-redirect to the mailto: URL (opens default mail app)
 */
router.get("/utils/mailto", async (req, res, next) => {
  try {
    const to = (req.query.to || "").toString();
    let subject = req.query.subject ? req.query.subject.toString() : "";
    let body = req.query.body ? req.query.body.toString() : "";
    const orderId = req.query.orderId ? req.query.orderId.toString() : "";
    const customerName = req.query.customerName ? req.query.customerName.toString() : "";
    const wantsRedirect = ["1","true","yes"].includes(String(req.query.redirect||"").toLowerCase());

    // If we have an orderId but no subject/body, ask our existing route to build them
    if (orderId && (!subject || !body)) {
      const port = process.env.PORT || 5000;
      const url = `http://127.0.0.1:${port}/api/sync/booqable/paylink-email`;
      const payload = { orderId, customerName };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const t = await r.text();
      if (r.ok) {
        let j; try { j = JSON.parse(t) } catch { j = {} }
        subject = subject || j?.email?.subject || "";
        body    = body    || j?.email?.body    || "";
      } else {
        return res.status(400).json({ ok:false, error:"Failed to build email from orderId", details:t.slice(0,200) });
      }
    }

    // Build mailto
    const enc = encodeURIComponent;
    const qp = [];
    if (subject) qp.push(`subject=${enc(subject)}`);
    if (body)    qp.push(`body=${enc(body)}`);
    const mailto = `mailto:${to}${qp.length ? "?" + qp.join("&") : ""}`;

    const out = { ok: true, mailto, to, subject, body };
    if (wantsRedirect && to) return res.redirect(mailto);
    return res.json(out);
  } catch (e) { next(e); }
});

export default router;