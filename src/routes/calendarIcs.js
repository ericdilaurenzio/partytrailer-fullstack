import express from "express";
import Hold from "../models/Hold.js";
import Reservation from "../models/Reservation.js";

const router = express.Router();

// ---- helpers ----
function pad(n){ return String(n).padStart(2,"0"); }
function toICSDate(dt){
  const d = new Date(dt);
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth()+1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}
function esc(text=""){
  return String(text)
    .replace(/\\/g,"\\\\")
    .replace(/\n/g,"\\n")
    .replace(/,/g,"\\,")
    .replace(/;/g,"\\;");
}
function fold(line){
  // Fold long ICS lines at 75 octets; simplest safe approach:
  const chunks=[];
  let i=0;
  while(i<line.length){ chunks.push(line.slice(i, i+70)); i+=70; }
  return chunks.map((c,idx)=> idx===0?c:` ${c}`).join("\r\n");
}
function vevent({uid, dtstamp, dtstart, dtend, summary, description, status, url}){
  const lines = [
    "BEGIN:VEVENT",
    `UID:${esc(uid)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${esc(summary)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    status ? `STATUS:${esc(status)}` : null,
    url ? `URL:${esc(url)}` : null,
    "END:VEVENT"
  ].filter(Boolean).map(fold);
  return lines.join("\r\n");
}

// ---- GET /api/calendar.ics ----
// Query (all optional):
//   from=ISO, to=ISO   (default: from=now-14d, to=now+180d)
//   includeHolds=1|0   (default 1)
//   includeBookings=1|0 (default 1)
//   tz is not required; we export as UTC (Z), calendar apps will convert to local time.
router.get("/calendar.ics", async (req, res, next) => {
  try {
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getTime()-14*24*3600*1000);
    const to   = req.query.to   ? new Date(req.query.to)   : new Date(now.getTime()+180*24*3600*1000);
    const incHolds    = String(req.query.includeHolds ?? "1") !== "0";
    const incBookings = String(req.query.includeBookings ?? "1") !== "0";

    const dtstamp = toICSDate(new Date());

    const events = [];

    // Holds (local-only)
    if (incHolds) {
      const q = { $or: [ { startAt: { $lt: to }, endAt: { $gt: from } } ] };
      const holds = await Hold.find(q).sort({ startAt: 1 }).lean();
      for (const h of holds) {
        if (!h.startAt || !h.endAt) continue;
        events.push(vevent({
          uid: `hold-${h._id}@partytrailer`,
          dtstamp,
          dtstart: toICSDate(h.startAt),
          dtend:   toICSDate(h.endAt),
          summary: `HOLD: ${h.customerName || "Tentative"}`,
          description: [
            h.notes ? `Notes: ${h.notes}` : null,
            h.customerEmail ? `Email: ${h.customerEmail}` : null,
            h.customerPhone ? `Phone: ${h.customerPhone}` : null,
          ].filter(Boolean).join("\n"),
          status: "TENTATIVE"
        }));
      }
    }

    // Bookings / Reservations (synced from Booqable into Mongo)
    if (incBookings) {
      // startAt may be null on some rows; we’ll skip those without a start/end
      const rq = {
        startAt: { $lt: to },
        endAt:   { $gt: from }
      };
      const bookings = await Reservation.find(rq).sort({ startAt: 1 }).lean();
      for (const r of bookings) {
        if (!r.startAt || !r.endAt) continue;
        const cust = r?.customer?.name || "Booking";
        const stat = (r.status || "").toUpperCase();
        const total =
          r?.totals?.grandTotal != null ? `Total: $${Number(r.totals.grandTotal).toFixed(2)}` : "";
        const descLines = [
          r.notes ? `Notes: ${r.notes}` : null,
          r?.customer?.email ? `Email: ${r.customer.email}` : null,
          r?.customer?.phone ? `Phone: ${r.customer.phone}` : null,
          r.externalId ? `Booqable ID: ${r.externalId}` : null,
          total || null
        ].filter(Boolean).join("\n");

        events.push(vevent({
          uid: `res-${r._id || r.externalId || Math.random().toString(36).slice(2)}@partytrailer`,
          dtstamp,
          dtstart: toICSDate(r.startAt),
          dtend:   toICSDate(r.endAt),
          summary: `BOOKING${stat ? " ["+stat+"]" : ""}: ${cust}`,
          description: descLines,
          status: stat && ["RESERVED","CONFIRMED","STARTED","STOPPED","CANCELED","ARCHIVED"].includes(stat) ? stat : "CONFIRMED"
        }));
      }
    }

    const header = [
      "BEGIN:VCALENDAR",
      "PRODID:-//PartyTrailer//Calendar//EN",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ].join("\r\n");

    const body = events.join("\r\n");
    const footer = "END:VCALENDAR";

    const ics = `${header}\r\n${body}\r\n${footer}\r\n`;

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=partytrailer-calendar.ics");
    return res.send(ics);
  } catch (e) { next(e); }
});

export default router;