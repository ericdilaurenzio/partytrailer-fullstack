import express from "express";

const router = express.Router();

/**
 * GET /api/calendar/subscribe.html
 * Shows BOTH options:
 *  - Apple Calendar (webcal:// via /api/calendar/subscribe?platform=ios)
 *  - Google Calendar (Add by URL via /api/calendar/subscribe?platform=android)
 *
 * Any of these query params (optional) are preserved in the links:
 *   includeHolds, includeBookings, from, to
 */
router.get("/calendar/subscribe.html", (req, res) => {
  // preserve any query params user added
  const params = new URLSearchParams();
  if (req.query.includeHolds)    params.set("includeHolds", String(req.query.includeHolds));
  if (req.query.includeBookings) params.set("includeBookings", String(req.query.includeBookings));
  if (req.query.from)            params.set("from", String(req.query.from));
  if (req.query.to)              params.set("to",   String(req.query.to));
  const qs = params.toString();
  const q  = qs ? `&${qs}` : "";

  // Links route through your smart redirect endpoint
  const appleHref  = `/api/calendar/subscribe?platform=ios${q}`;
  const googleHref = `/api/calendar/subscribe?platform=android${q}`;

  // Light device-detect to ORDER buttons (but never hide)
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  const isApple   = /iphone|ipad|mac os x/.test(ua);
  const isAndroid = /android/.test(ua);

  // simple CSS + accessible HTML
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Subscribe to Party Trailer Calendar</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#111}
      .wrap{max-width:720px;margin:0 auto}
      h1{font-size:1.5rem;margin:0 0 8px}
      p{color:#444;margin:0 0 16px}
      .row{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
      a.btn{display:inline-block;padding:12px 16px;border-radius:12px;text-decoration:none;border:1px solid #ddd}
      a.btn:hover{border-color:#aaa}
      .apple{background:#000;color:#fff}
      .google{background:#fff;color:#111}
      code,kbd{background:#f6f6f6;padding:2px 6px;border-radius:6px;border:1px solid #eee}
      .links{margin-top:16px}
      .links code{display:block;overflow:auto}
      .note{font-size:0.9rem;color:#555;margin-top:8px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Subscribe to Party Trailer Calendar</h1>
      <p>Pick your calendar app. Both options work from any device.</p>

      <div class="row" id="buttons">
        <a class="btn apple"  id="apple"  href="${appleHref}"  rel="noopener">Subscribe in Apple Calendar</a>
        <a class="btn google" id="google" href="${googleHref}" rel="noopener">Subscribe in Google Calendar</a>
      </div>

      <div class="links">
        <p>Direct links (copy/paste if needed):</p>
        <code id="appleUrl">${appleHref}</code>
        <code id="googleUrl">${googleHref}</code>
        <p class="note">Tip: On iPhone, Apple opens directly. For Google on iPhone, you’ll be taken to Google Calendar on the web to add the URL, then it syncs to the app.</p>
      </div>
    </div>

    <script>
      // Re-order buttons for convenience only; both remain visible.
      (function(){
        var isApple = ${JSON.stringify(isApple)};
        var isAndroid = ${JSON.stringify(isAndroid)};
        var buttons = document.getElementById("buttons");
        var apple = document.getElementById("apple");
        var google = document.getElementById("google");
        if (isAndroid) { buttons.prepend(google); } // Google first on Android
        else if (isApple) { buttons.prepend(apple); } // Apple first on iOS/macOS
      })();
    </script>
  </body>
</html>`;
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.send(html);
});

export default router;