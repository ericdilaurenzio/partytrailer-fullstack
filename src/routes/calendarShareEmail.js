import express from "express";

const router = express.Router();

function nowVersion() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

router.get("/", async (req, res) => {
  try {
    const { to = "", v } = req.query;
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
    if (!base) return res.status(500).json({ ok: false, error: "PUBLIC_BASE_URL is not set in .env" });

    const version = (v && String(v)) || nowVersion();

    const icsUrl = `${base}/api/calendar.ics?v=${encodeURIComponent(version)}`;
    const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icsUrl)}`;
    const appleUrl = `webcal://${base.replace(/^https?:\/\//, "")}/api/calendar.ics?v=${encodeURIComponent(version)}`;
    const choiceUrl = `${base}/api/calendar/subscribe?v=${encodeURIComponent(version)}`;

    const links = { choice: choiceUrl, google: googleUrl, apple: appleUrl, ics: icsUrl };

    const subject = `Add The Party Trailer schedule to your calendar`;
    const body = [
      `Hi,`,
      ``,
      `Tap one of the links below to subscribe to The Party Trailer schedule:`,
      `• Google Calendar: ${googleUrl}`,
      `• Apple Calendar (iPhone/Mac): ${appleUrl}`,
      `• Direct ICS file: ${icsUrl}`,
      ``,
      `Tip: Subscribing keeps your calendar auto-updated when our schedule changes.`,
      ``,
      `Thanks!`,
      `The Party Trailer`,
    ].join("\n");

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return res.json({ ok: true, subject, body, mailto, links });
  } catch (err) {
    console.error("share-email error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
