$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm was not found. Install Node.js 22 or newer."
}
$nodeFile = (Get-Command node.exe -ErrorAction Stop).Source

$python = Get-Command py.exe -ErrorAction SilentlyContinue
if ($python) {
    $pythonFile = $python.Source
    $pythonArgs = @("-3", "python_backend\server.py")
} else {
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $python) { throw "Python 3.10 or newer was not found." }
    $pythonFile = $python.Source
    $pythonArgs = @("python_backend\server.py")
}

if (-not (Test-Path -LiteralPath "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
}

$backend = Start-Process -FilePath $pythonFile -ArgumentList $pythonArgs -WorkingDirectory $root -WindowStyle Hidden -PassThru
$browserJob = $null
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 1
            if ($health.status -eq "ok") { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw "The Python backend did not become ready on port 8765." }

    Write-Host "Saarthi backend is ready at http://127.0.0.1:8765" -ForegroundColor Green
    $browserJob = Start-Job -ScriptBlock {
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            try {
                $response = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -TimeoutSec 1 -UseBasicParsing
                if ($response.StatusCode -eq 200) { Start-Process "http://127.0.0.1:5173"; return }
            } catch { Start-Sleep -Milliseconds 500 }
        }
    }
    Write-Host "Starting the React command center at http://127.0.0.1:5173" -ForegroundColor Green
    Write-Host "Saarthi is running. Press Ctrl+C to stop both services." -ForegroundColor Cyan
    & $nodeFile "node_modules\next\dist\bin\next" dev -p 5173 -H 127.0.0.1
    exit $LASTEXITCODE
} finally {
    if ($browserJob) { Stop-Job -Job $browserJob -ErrorAction SilentlyContinue; Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue }
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
