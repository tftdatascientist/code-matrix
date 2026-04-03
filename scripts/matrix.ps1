<#
.SYNOPSIS
  Uruchamia Matrix GUI — bridge (z Claude) + GUI w przegladarce.
  Wpisz "cm" w PowerShell aby uruchomic.
#>

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$WsPort = 7999

$esc = [char]27
$green = "${esc}[32m"
$dim = "${esc}[2m"
$reset = "${esc}[0m"

function Write-Matrix($msg) { Write-Host "${green}[MATRIX]${reset} $msg" }
function Write-MatrixDim($msg) { Write-Host "${dim}  $msg${reset}" }

Write-Matrix "Starting Matrix GUI (node-pty mode)..."

# Zabij stare procesy na porcie
$oldPids = netstat -ano | Select-String ":$WsPort\s" | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }

if ($oldPids) {
    Write-Matrix "Cleaning up old processes on port ${WsPort}..."
    foreach ($procId in $oldPids) {
        try { Stop-Process -Id $procId -Force -ErrorAction Stop } catch { }
    }
    Start-Sleep -Seconds 1
}

# Otwieramy przegladarke z opoznieniem (czas na start Vite)
Start-Process "cmd.exe" -ArgumentList "/c","timeout /t 8 /nobreak >nul && start http://localhost:5173" -WindowStyle Hidden

Write-Matrix "Browser will open in ~8s..."
Write-Matrix "Bridge + GUI starting via concurrently..."
Write-Matrix "Press Ctrl+C to stop everything."
Write-Host ""

# Uruchom bridge + GUI razem (concurrently z root package.json)
Set-Location $ProjectRoot
& npm run dev
