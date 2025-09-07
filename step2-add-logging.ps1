# step2-add-logging.ps1
$serverPath = "C:\Projects\partytrailer-fullstack\backend\server.js"

if (-not (Test-Path $serverPath)) {
  Write-Host "❌ Cannot find $serverPath" -ForegroundColor Red
  exit 1
}

# 1) Backup
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $serverPath "$serverPath.bak_$ts" -Force
Write-Host "✔ Backup created: $serverPath.bak_$ts" -ForegroundColor Green

# 2) Read
$content = Get-Content $serverPath -Raw

# 3) Prepend crash handlers + env logging if missing
$prepend = @'
process.on('unhandledRejection', (err) => { console.error('UNHANDLED REJECTION:', err); process.exit(1); });
process.on('uncaughtException', (err) => { console.error('UNCAUGHT EXCEPTION:', err); process.exit(1); });

console.log('BOOT:', {
  NODE_ENV: process.env.NODE_ENV,
  HAS_MONGO_URI: !!process.env.MONGO_URI,
  PORT: process.env.PORT,
});
'@

if ($content -notmatch "process\.on\('unhandledRejection'") {
  $content = $prepend + "`r`n" + $content
  Write-Host "✔ Added crash handlers + env log" -ForegroundColor Green
}

# 4) Ensure express.json()
if ($content -notmatch "express\.json\(\)") {
  $content = $content -replace "(const\s+app\s*=\s*express\(\)\s*;)", '$1' + "`r`n" + 'app.use(express.json());'
  Write-Host "✔ Added app.use(express.json())" -ForegroundColor Green
}

# 5) Ensure router mount for /api/messages
if ($content -notmatch "app\.use\(\s*'/api/messages'\s*,\s*require\('./routes/messages\.routes'\)\s*\)") {
  if ($content -match "app\.listen\(") {
    $content = $content -replace "(app\.listen\()", "app.use('/api/messages', require('./routes/messages.routes'));" + "`r`n`r`n" + '$1'
  } else {
    $content = $content + "`r`n" + "app.use('/api/messages', require('./routes/messages.routes'));"
  }
  Write-Host "✔ Mounted /api/messages router" -ForegroundColor Green
}

# 6) Ensure /health endpoint
if ($content -notmatch "app\.get\('/health'") {
  $content = $content + "`r`n" + "app.get('/health', (req,res) => res.json({ ok: true }));"
  Write-Host "✔ Added /health route" -ForegroundColor Green
}

# 7) Ensure it listens on process.env.PORT
if ($content -match "const\s+PORT\s*=\s*\d+;") {
  $content = $content -replace "const\s+PORT\s*=\s*\d+;", "const PORT = process.env.PORT || 10000;"
  Write-Host "✔ Replaced hardcoded PORT with process.env.PORT" -ForegroundColor Green
} elseif ($content -notmatch "process\.env\.PORT") {
  # If no PORT definition exists, append a default listen block at the end
  $content = $content + "`r`n" + "const PORT = process.env.PORT || 10000;" + "`r`n" + "app.listen(PORT, () => console.log(`🚀 Server listening on :${PORT}`));"
  Write-Host "✔ Added listen block with process.env.PORT" -ForegroundColor Green
}

# 8) Write back
Set-Content $serverPath $content -Encoding UTF8
Write-Host "✔ server.js patched successfully" -ForegroundColor Green
