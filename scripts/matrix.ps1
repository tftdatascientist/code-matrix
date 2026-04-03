<#
.SYNOPSIS
  Uruchamia Matrix GUI — bridge + GUI + Claude z przechwytywaniem output.
  Wpisz "m" w PowerShell aby uruchomić (po dodaniu aliasu do profilu).
#>

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PipePath = Join-Path ([System.IO.Path]::GetTempPath()) "cc-matrix-pipe"
$WsPort = 7999

# Kolory Matrix
$green = "`e[32m"
$dim = "`e[2m"
$red = "`e[31m"
$reset = "`e[0m"

function Write-Matrix($msg) { Write-Host "${green}[MATRIX]${reset} $msg" }
function Write-MatrixDim($msg) { Write-Host "${dim}  $msg${reset}" }
function Write-MatrixError($msg) { Write-Host "${red}[MATRIX]${reset} $msg" }

Write-Matrix "Starting Matrix GUI..."

# 0. Zabij stare procesy na porcie (zombie cleanup)
$oldPids = netstat -ano | Select-String ":$WsPort\s" | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }

if ($oldPids) {
    Write-Matrix "Cleaning up old processes on port ${WsPort}..."
    foreach ($pid in $oldPids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-MatrixDim "Killed PID $pid"
        } catch {
            Write-MatrixDim "PID $pid already gone"
        }
    }
    Start-Sleep -Seconds 1
}

# 1. Utwórz pipe file (bridge go potrzebuje)
if (-not (Test-Path $PipePath)) {
    New-Item -Path $PipePath -ItemType File -Force | Out-Null
} else {
    Clear-Content -Path $PipePath
}
Write-MatrixDim "Pipe: $PipePath"

# 2. Uruchom bridge w tle (jako Job — widoczne błędy)
$bridgeJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    & npm run dev:bridge 2>&1
} -ArgumentList $ProjectRoot

Write-Matrix "Bridge starting (Job: $($bridgeJob.Id))..."

# 3. Uruchom GUI w tle (jako Job)
$guiJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    & npm run dev:gui 2>&1
} -ArgumentList $ProjectRoot

Write-Matrix "GUI starting (Job: $($guiJob.Id))..."

# 4. Czekaj na serwery z weryfikacją
Write-Matrix "Waiting for servers..."
$maxWait = 15
$waited = 0
$bridgeReady = $false
$guiReady = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++

    # Sprawdź czy bridge nie crashnął
    if ($bridgeJob.State -eq 'Failed' -or $bridgeJob.State -eq 'Completed') {
        Write-MatrixError "Bridge failed to start!"
        $bridgeOutput = Receive-Job -Job $bridgeJob 2>&1
        Write-Host ($bridgeOutput | Out-String)
        # Cleanup
        Remove-Job -Job $bridgeJob -Force -ErrorAction SilentlyContinue
        Remove-Job -Job $guiJob -Force -ErrorAction SilentlyContinue
        Stop-Job -Job $guiJob -ErrorAction SilentlyContinue
        return
    }

    # Sprawdź bridge
    if (-not $bridgeReady) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("localhost", $WsPort)
            $tcp.Close()
            $bridgeReady = $true
            Write-MatrixDim "Bridge ready on :$WsPort"
        } catch { }
    }

    # Sprawdź GUI (Vite)
    if (-not $guiReady) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("localhost", 5173)
            $tcp.Close()
            $guiReady = $true
            Write-MatrixDim "GUI ready on :5173"
        } catch { }
    }

    if ($bridgeReady -and $guiReady) { break }
}

if (-not $bridgeReady -or -not $guiReady) {
    Write-MatrixError "Servers failed to start in ${maxWait}s."
    if (-not $bridgeReady) {
        Write-MatrixError "Bridge output:"
        Receive-Job -Job $bridgeJob 2>&1 | Write-Host
    }
    if (-not $guiReady) {
        Write-MatrixError "GUI output:"
        Receive-Job -Job $guiJob 2>&1 | Write-Host
    }
    Stop-Job -Job $bridgeJob -ErrorAction SilentlyContinue
    Stop-Job -Job $guiJob -ErrorAction SilentlyContinue
    Remove-Job -Job $bridgeJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $guiJob -Force -ErrorAction SilentlyContinue
    return
}

# 5. Otwórz GUI w przeglądarce
Start-Process "http://localhost:5173"
Write-Matrix "GUI opened in browser"

# 6. Uruchom Claude z przechwytywaniem output do pipe
Write-Matrix "Launching Claude with output capture..."
Write-Matrix "Type 'exit' in Claude or Ctrl+C to stop."
Write-Host ""

try {
    # Tee-Object: wyświetla na ekran + pisze do pliku jednocześnie
    # Plik jest już pusty (cleared wcześniej), Tee-Object streamuje w real-time
    claude 2>&1 | Tee-Object -FilePath $PipePath
}
finally {
    Write-Host ""
    Write-Matrix "Shutting down..."

    # Zatrzymaj joby
    Stop-Job -Job $bridgeJob -ErrorAction SilentlyContinue
    Stop-Job -Job $guiJob -ErrorAction SilentlyContinue
    Remove-Job -Job $bridgeJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $guiJob -Force -ErrorAction SilentlyContinue

    # Zabij procesy node na porcie bridge
    $pids = netstat -ano | Select-String ":$WsPort\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }

    foreach ($pid in $pids) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }

    # Usuń pipe file
    Remove-Item -Path $PipePath -Force -ErrorAction SilentlyContinue

    Write-Matrix "Disconnected."
}
