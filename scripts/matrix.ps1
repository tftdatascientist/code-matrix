<#
.SYNOPSIS
  Uruchamia Matrix GUI — bridge (z Claude wbudowanym) + GUI w przegladarce.
  Bridge sam spawnuje Claude przez node-pty (dwukierunkowy PTY).
  Wpisz "cm" w PowerShell aby uruchomic.
  Kompatybilny z Windows PowerShell 5.1 i PowerShell 7+.
#>

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$WsPort = 7999

# Kolory Matrix (kompatybilne z PS 5.1)
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

# 1. Uruchom GUI w tle jako osobny proces (nie Job — unika problemow z PS 5.1)
$guiProc = Start-Process -FilePath "npm" -ArgumentList "run","dev:gui" `
    -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Minimized

Write-Matrix "GUI starting (PID: $($guiProc.Id))..."

# 2. Czekaj na GUI
Write-Matrix "Waiting for GUI server..."
$maxWait = 30
$waited = 0
$guiReady = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++

    if ($guiProc.HasExited) {
        Write-MatrixError "GUI process exited unexpectedly (code: $($guiProc.ExitCode))"
        return
    }

    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 5173)
        $tcp.Close()
        $guiReady = $true
        Write-MatrixDim "GUI ready on :5173 (${waited}s)"
        break
    } catch { }
}

if (-not $guiReady) {
    Write-MatrixError "GUI failed to start in ${maxWait}s."
    Stop-Process -Id $guiProc.Id -Force -ErrorAction SilentlyContinue
    return
}

# 3. Otworz GUI w przegladarce
Start-Process "http://localhost:5173"
Write-Matrix "GUI opened in browser"

# 4. Uruchom bridge na pierwszym planie (bridge spawnuje Claude sam)
Write-Matrix "Starting Bridge + Claude (node-pty)..."
Write-Matrix "Press Ctrl+C to stop everything."
Write-Host ""

try {
    Set-Location $ProjectRoot
    & npm run dev:bridge
}
finally {
    Write-Host ""
    Write-Matrix "Shutting down..."

    # Zatrzymaj GUI proces i jego dzieci
    if (-not $guiProc.HasExited) {
        Stop-Process -Id $guiProc.Id -Force -ErrorAction SilentlyContinue
    }
    # Zabij ewentualne procesy node Vite (dzieci GUI)
    Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq '' } |
        ForEach-Object {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
                if ($cmdLine -and $cmdLine -match 'vite') {
                    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
                }
            } catch { }
        }

    # Zabij procesy na porcie bridge
    $procIds = netstat -ano | Select-String ":$WsPort\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }

    foreach ($procId in $procIds) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }

    Write-Matrix "Disconnected."
}
