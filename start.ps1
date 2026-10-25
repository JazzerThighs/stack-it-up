$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    node tools/build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    Start-Process 'http://127.0.0.1:4173'
    node tools/serve.mjs
} finally { Pop-Location }
