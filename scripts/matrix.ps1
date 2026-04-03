<#
.SYNOPSIS
  Uruchamia Matrix GUI — bridge (z Claude wbudowanym) + GUI w przegladarce.
  Bridge sam spawnuje Claude przez node-pty (dwukierunkowy PTY).
  Wpisz "cm" w PowerShell aby uruchomic.
  Kompatybilny z Windows PowerShell 5.1 i PowerShell 7+.
#>

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$WsPort = 7999

# Kolory Matrix (kompatybilne z PS 5.1 — [char]27 zamiast `e)
$esc = [char]27
$green = "${esc}[32m"
$dim = "${esc}[2m"
$red = "${esc}[31m"
$reset = "${esc}[0m"

function Write-Matrix($msg) { Write-Host "${green}[MATRIX]${reset} $msg" }
function Write-MatrixDim($msg) { Write-Host "${dim}  $msg${reset}" }
function Write-MatrixError($msg) { Write-Host "${red}[MATRIX]${reset} $msg" }

Write-Matrix "Starting Matrix GUI (node-pty mode)..."

# 0. Zabij stare procesy na porcie (zombie cleanup)
$oldPids = netstat -ano | Select-String ":$WsPort\s" | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }

if ($oldPids) {
    Write-Matrix "Cleaning up old processes on port ${WsPort}..."
    foreach ($procId in $oldPids) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-MatrixDim "Killed PID $procId"
        } catch {
            Write-MatrixDim "PID $procId already gone"
        }
    }
    Start-Sleep -Seconds 1
}

# 1. Set env for node-pty mode
$env:MATRIX_PTY_SOURCE = "node-pty"
$env:MATRIX_COMMAND_ENABLED = "true"

# 2. Uruchom GUI w tle (jako Job)
$guiJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    & npm run dev:gui 2>&1
} -ArgumentList $ProjectRoot

Write-Matrix "GUI starting (Job: $($guiJob.Id))..."

# 3. Czekaj na GUI (uzyj 127.0.0.1 zamiast localhost — unika problemow z IPv6)
Write-Matrix "Waiting for GUI server..."
$maxWait = 30
$waited = 0
$guiReady = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++

    if (-not $guiReady) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 5173)
            $tcp.Close()
            $guiReady = $true
            Write-MatrixDim "GUI ready on :5173"
        } catch { }
    }

    if ($guiReady) { break }
}

if (-not $guiReady) {
    Write-MatrixError "GUI failed to start in ${maxWait}s."
    Receive-Job -Job $guiJob 2>&1 | Write-Host
    Stop-Job -Job $guiJob -ErrorAction SilentlyContinue
    Remove-Job -Job $guiJob -Force -ErrorAction SilentlyContinue
    return
}

# 4. Otworz GUI w przegladarce
Start-Process "http://localhost:5173"
Write-Matrix "GUI opened in browser"

# 5. Uruchom bridge na pierwszym planie (bridge spawnuje Claude sam)
Write-Matrix "Starting Bridge + Claude (node-pty)..."
Write-Matrix "Claude will start inside the bridge. Use GUI or this terminal."
Write-Matrix "Press Ctrl+C to stop everything."
Write-Host ""

try {
    Set-Location $ProjectRoot
    & npm run dev:bridge
}
finally {
    Write-Host ""
    Write-Matrix "Shutting down..."

    # Zatrzymaj GUI job
    Stop-Job -Job $guiJob -ErrorAction SilentlyContinue
    Remove-Job -Job $guiJob -Force -ErrorAction SilentlyContinue

    # Zabij procesy node na porcie bridge
    $procIds = netstat -ano | Select-String ":$WsPort\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }

    foreach ($procId in $procIds) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }

    # Wyczysc env
    Remove-Item Env:\MATRIX_PTY_SOURCE -ErrorAction SilentlyContinue
    Remove-Item Env:\MATRIX_COMMAND_ENABLED -ErrorAction SilentlyContinue

    Write-Matrix "Disconnected."
}
