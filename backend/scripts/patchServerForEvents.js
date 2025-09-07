const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let src = fs.readFileSync(serverPath, 'utf8');

if (!src.includes(\"req.io = io\")) {
  const where = src.indexOf('app.use(');
  if (where !== -1) {
    src = src.slice(0, where) + \"\\n// Attach Socket.IO instance to requests\\napp.use((req, _res, next) => { req.io = io; next(); });\\n\" + src.slice(where);
  } else {
    // fallback: put after express app created
    src = src.replace(/const\\s+app\\s*=\\s*express\\(\\);?/,
      m => m + \"\\n// Attach Socket.IO instance to requests\\napp.use((req, _res, next) => { req.io = io; next(); });\");
  }
}

if (!src.includes(\"/api/events\")) {
  // ensure router require
  if (!src.includes(\"const eventsRouter\")) {
    src = src.replace(/(const\\s+app\\s*=\\s*express\\(\\);?)/,
      $1\\nconst eventsRouter = require('./routes/events'););
  }
  // mount router before server.listen
  src = src.replace(/(server\\.listen\\([\\s\\S]*?\\);)/,
    pp.use('/api/events', eventsRouter);\\n\\n);
}

fs.writeFileSync(serverPath, src, 'utf8');
console.log('Patched server.js for events router and io handoff.');
