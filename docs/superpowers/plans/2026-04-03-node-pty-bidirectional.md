# node-pty Bidirectional PTY — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace read-only pipe capture with `node-pty` so the Bridge spawns Claude Code as a child process, giving GUI full bidirectional stdin/stdout control.

**Architecture:** Bridge gets a new `PtySpawner` class that uses `node-pty` to spawn `claude` and exposes the same EventEmitter interface as `PtyReader`. `PtyReader.writeStdin()` becomes functional. `matrix.ps1` is simplified — it no longer launches Claude itself, the Bridge does.

**Tech Stack:** node-pty (native PTY), existing ws/tsx/TypeScript stack

---

### Task 1: Install node-pty dependency

**Files:**
- Modify: `packages/bridge/package.json`

- [ ] **Step 1: Install node-pty**

```bash
cd packages/bridge
npm install node-pty
```

This adds `node-pty` to `dependencies` in `packages/bridge/package.json`.

- [ ] **Step 2: Verify installation**

```bash
cd packages/bridge
node -e "const pty = require('node-pty'); console.log('node-pty OK, version:', require('node-pty/package.json').version)"
```

Expected: prints version without errors. If native compilation fails, may need `npm install -g windows-build-tools` or Visual Studio Build Tools.

- [ ] **Step 3: Commit**

```bash
git add packages/bridge/package.json packages/bridge/package-lock.json
git commit -m "feat(bridge): add node-pty dependency for bidirectional PTY"
```

---

### Task 2: Create PtySpawner class

**Files:**
- Create: `packages/bridge/src/pty-spawner.ts`

- [ ] **Step 1: Create PtySpawner**

```typescript
// packages/bridge/src/pty-spawner.ts
import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';
import { platform } from 'node:os';

export interface PtySpawnerEvents {
  data: [Buffer];
  error: [Error];
  close: [number | undefined]; // exit code
}

export interface PtySpawnerOptions {
  command?: string;      // default: 'claude'
  args?: string[];       // default: []
  cols?: number;         // default: 120
  rows?: number;         // default: 40
  cwd?: string;          // default: process.cwd()
}

/**
 * Spawns a process in a real PTY using node-pty.
 * Provides bidirectional stdin/stdout access.
 * Same EventEmitter interface as PtyReader for drop-in compatibility.
 */
export class PtySpawner extends EventEmitter<PtySpawnerEvents> {
  private ptyProcess: pty.IPty | null = null;
  private _connected = false;

  constructor(private options: PtySpawnerOptions = {}) {
    super();
  }

  async start(): Promise<void> {
    const shell = platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
    const command = this.options.command ?? 'claude';
    const args = this.options.args ?? [];
    const cols = this.options.cols ?? 120;
    const rows = this.options.rows ?? 40;
    const cwd = this.options.cwd ?? process.cwd();

    try {
      this.ptyProcess = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: process.env as Record<string, string>,
      });

      this._connected = true;

      this.ptyProcess.onData((data: string) => {
        this.emit('data', Buffer.from(data, 'utf-8'));
      });

      this.ptyProcess.onExit(({ exitCode }) => {
        this._connected = false;
        this.emit('close', exitCode);
      });

      console.log(`PTY spawned: ${command} ${args.join(' ')} (PID: ${this.ptyProcess.pid})`);
    } catch (err) {
      this._connected = false;
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      throw error;
    }
  }

  writeStdin(data: string): void {
    if (!this.ptyProcess || !this._connected) {
      console.warn('writeStdin: PTY not connected');
      return;
    }
    this.ptyProcess.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!this.ptyProcess || !this._connected) return;
    this.ptyProcess.resize(cols, rows);
  }

  async stop(): Promise<void> {
    if (this.ptyProcess) {
      this._connected = false;
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
    this.emit('close', undefined);
  }

  get connected(): boolean {
    return this._connected;
  }

  get pid(): number | undefined {
    return this.ptyProcess?.pid;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/bridge
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/bridge/src/pty-spawner.ts
git commit -m "feat(bridge): add PtySpawner class with node-pty bidirectional PTY"
```

---

### Task 3: Integrate PtySpawner into Bridge index.ts

**Files:**
- Modify: `packages/bridge/src/index.ts`

- [ ] **Step 1: Update index.ts to support `node-pty` source**

Replace the entire `packages/bridge/src/index.ts` with:

```typescript
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PtyReader } from './pty-reader.js';
import { PtySpawner } from './pty-spawner.js';
import { BridgeWSServer } from './ws-server.js';
import { SessionParser } from './session-parser.js';
import { CommandRouter, type CommandPayload } from './command-router.js';

const WS_PORT = parseInt(process.env.MATRIX_WS_PORT || '7999', 10);
const PTY_SOURCE = process.env.MATRIX_PTY_SOURCE || 'pipe';
const PTY_PIPE = process.env.MATRIX_PTY_PIPE || join(tmpdir(), 'cc-matrix-pipe');
const BUFFER_SIZE = parseInt(process.env.MATRIX_BUFFER_SIZE || '10000', 10);
const COMMAND_ENABLED = process.env.MATRIX_COMMAND_ENABLED === 'true';
const PTY_COMMAND = process.env.MATRIX_PTY_COMMAND || 'claude';
const PTY_ARGS = process.env.MATRIX_PTY_ARGS?.split(' ').filter(Boolean) ?? [];
const PTY_COLS = parseInt(process.env.MATRIX_PTY_COLS || '120', 10);
const PTY_ROWS = parseInt(process.env.MATRIX_PTY_ROWS || '40', 10);

console.log('Matrix Bridge starting...');
console.log(`  PTY source: ${PTY_SOURCE}`);
if (PTY_SOURCE === 'node-pty') {
  console.log(`  PTY command: ${PTY_COMMAND} ${PTY_ARGS.join(' ')}`);
  console.log(`  PTY size:    ${PTY_COLS}x${PTY_ROWS}`);
} else {
  console.log(`  Pipe path:  ${PTY_PIPE}`);
}
console.log(`  Commands:   ${COMMAND_ENABLED || PTY_SOURCE === 'node-pty' ? 'ENABLED' : 'disabled'}`);

// Start WebSocket server
const wsServer = new BridgeWSServer(WS_PORT, BUFFER_SIZE);

wsServer.onListening(() => {
  console.log(`WebSocket server listening on :${WS_PORT}`);
});

wsServer.startHeartbeat();

// Start session parser
const sessionParser = new SessionParser();

// Send current session state to newly connected clients
wsServer.onConnect((ws) => {
  wsServer.sendToClient(ws, 'session:metrics', sessionParser.getMetrics());
  wsServer.sendToClient(ws, 'session:state', sessionParser.getState());
});

sessionParser.on('metrics', (metrics) => {
  wsServer.broadcast('session:metrics', metrics);
});

sessionParser.on('state', (state) => {
  wsServer.broadcast('session:state', state);
});

// Create PTY source based on config
type PtySource = PtyReader | PtySpawner;

let ptySource: PtySource;

if (PTY_SOURCE === 'node-pty') {
  ptySource = new PtySpawner({
    command: PTY_COMMAND,
    args: PTY_ARGS,
    cols: PTY_COLS,
    rows: PTY_ROWS,
  });
} else {
  ptySource = new PtyReader(PTY_SOURCE, PTY_PIPE);
}

// Command router — auto-enabled for node-pty mode
const commandsActive = COMMAND_ENABLED || PTY_SOURCE === 'node-pty';

// CommandRouter needs writeStdin — create a compatible wrapper
const commandRouter = new CommandRouter(commandsActive, {
  writeStdin: (data: string) => ptySource.writeStdin(data),
} as PtyReader);

wsServer.onMessage((msg) => {
  if (msg.channel === 'command:input') {
    commandRouter.handle(msg.payload as CommandPayload);
  }
  if (msg.channel === 'terminal:resize' && ptySource instanceof PtySpawner) {
    const { cols, rows } = msg.payload as { cols: number; rows: number };
    ptySource.resize(cols, rows);
  }
});

ptySource.on('data', (chunk: Buffer) => {
  wsServer.sendTerminalData(chunk);
  sessionParser.feed(chunk);
});

ptySource.on('error', (err: Error) => {
  console.error('PTY error:', err.message);
});

ptySource.on('close', (...args: unknown[]) => {
  if (PTY_SOURCE === 'node-pty') {
    const exitCode = args[0] as number | undefined;
    console.log(`Claude process exited (code: ${exitCode ?? 'unknown'})`);
  } else {
    console.log('PTY source closed');
  }
  wsServer.ptyConnected = false;
});

ptySource.start()
  .then(() => {
    console.log('PTY source connected');
    wsServer.ptyConnected = true;
  })
  .catch((err: Error) => {
    console.error('PTY source failed to start:', err.message);
    console.log('Bridge running without PTY source — waiting for connection...');
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  ptySource.stop();
  wsServer.close();
  process.exit(0);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/bridge
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/bridge/src/index.ts
git commit -m "feat(bridge): integrate PtySpawner, auto-enable commands in node-pty mode"
```

---

### Task 4: Update CommandRouter to accept interface instead of concrete PtyReader

**Files:**
- Modify: `packages/bridge/src/command-router.ts`

- [ ] **Step 1: Update CommandRouter to use interface**

Replace the entire `packages/bridge/src/command-router.ts` with:

```typescript
export interface CommandPayload {
  type: 'text' | 'interrupt' | 'confirm';
  text?: string;
}

export interface StdinWriter {
  writeStdin(data: string): void;
}

const MAX_LENGTH = 10000;
const RATE_LIMIT = 10; // per minute
const RATE_WINDOW = 60_000;

export class CommandRouter {
  private enabled: boolean;
  private writer: StdinWriter;
  private commandTimestamps: number[] = [];

  constructor(enabled: boolean, writer: StdinWriter) {
    this.enabled = enabled;
    this.writer = writer;
  }

  handle(payload: CommandPayload): { ok: boolean; error?: string } {
    if (!this.enabled) {
      console.warn('Command channel disabled. Set MATRIX_COMMAND_ENABLED=true or use MATRIX_PTY_SOURCE=node-pty to enable.');
      return { ok: false, error: 'Command channel disabled' };
    }

    // Rate limiting
    const now = Date.now();
    this.commandTimestamps = this.commandTimestamps.filter(t => now - t < RATE_WINDOW);
    if (this.commandTimestamps.length >= RATE_LIMIT) {
      console.warn('Command rate limit exceeded');
      return { ok: false, error: 'Rate limit exceeded' };
    }
    this.commandTimestamps.push(now);

    switch (payload.type) {
      case 'text': {
        const text = payload.text ?? '';
        if (text.length > MAX_LENGTH) {
          return { ok: false, error: `Text exceeds max length (${MAX_LENGTH})` };
        }
        // Write to PTY stdin (text + newline)
        this.writer.writeStdin(text + '\n');
        console.log(`Command sent: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);
        return { ok: true };
      }
      case 'interrupt':
        // Send Ctrl+C (ETX character)
        this.writer.writeStdin('\x03');
        console.log('Command: interrupt (Ctrl+C)');
        return { ok: true };
      case 'confirm':
        // Send Enter
        this.writer.writeStdin('\n');
        console.log('Command: confirm (Enter)');
        return { ok: true };
      default:
        return { ok: false, error: `Unknown command type: ${(payload as CommandPayload).type}` };
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/bridge
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/bridge/src/command-router.ts
git commit -m "refactor(bridge): CommandRouter uses StdinWriter interface instead of concrete PtyReader"
```

---

### Task 5: Update matrix.ps1 for node-pty mode

**Files:**
- Modify: `scripts/matrix.ps1`

- [ ] **Step 1: Rewrite matrix.ps1**

Replace the entire `scripts/matrix.ps1` with:

```powershell
<#
.SYNOPSIS
  Uruchamia Matrix GUI — bridge (z Claude wbudowanym) + GUI w przegladarce.
  Bridge sam spawnuje Claude przez node-pty (dwukierunkowy PTY).
  Wpisz "cm" w PowerShell aby uruchomic.
#>

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$WsPort = 7999

# Kolory Matrix
$green = "`e[32m"
$dim = "`e[2m"
$red = "`e[31m"
$reset = "`e[0m"

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

# 3. Czekaj na GUI
Write-Matrix "Waiting for GUI server..."
$maxWait = 15
$waited = 0
$guiReady = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++

    if (-not $guiReady) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("localhost", 5173)
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
    $pids = netstat -ano | Select-String ":$WsPort\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }

    foreach ($pid in $pids) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }

    # Wyczysc env
    Remove-Item Env:\MATRIX_PTY_SOURCE -ErrorAction SilentlyContinue
    Remove-Item Env:\MATRIX_COMMAND_ENABLED -ErrorAction SilentlyContinue

    Write-Matrix "Disconnected."
}
```

- [ ] **Step 2: Update .env.example**

In `.env.example`, update the comment for `MATRIX_PTY_SOURCE` and add new variables:

```env
# Bridge Server
MATRIX_WS_PORT=7999
MATRIX_PTY_SOURCE=node-pty       # node-pty (recommended) | pipe | stdin
# MATRIX_PTY_PIPE=/tmp/cc-matrix-pipe   # only for pipe mode
MATRIX_BUFFER_SIZE=10000

# node-pty mode settings
MATRIX_PTY_COMMAND=claude        # command to spawn in PTY
# MATRIX_PTY_ARGS=              # extra args (space-separated)
MATRIX_PTY_COLS=120              # terminal columns
MATRIX_PTY_ROWS=40               # terminal rows

# GUI
MATRIX_WS_URL=ws://localhost:7999
MATRIX_ALWAYS_ON_TOP=true
MATRIX_OPACITY=0.95
MATRIX_RAIN_SPEED=1.0
MATRIX_RAIN_DENSITY=0.7

# Command Input (auto-enabled in node-pty mode)
MATRIX_COMMAND_ENABLED=false
```

- [ ] **Step 3: Commit**

```bash
git add scripts/matrix.ps1 .env.example
git commit -m "feat: update matrix.ps1 for node-pty mode, bridge spawns Claude directly"
```

---

### Task 6: Update GUI — show command input by default in node-pty mode

**Files:**
- Modify: `packages/gui/src/components/CommandInput.tsx`
- Modify: `packages/gui/src/App.tsx`

- [ ] **Step 1: Add auto-show logic based on server health**

In `CommandInput.tsx`, add a prop `autoShow` and use it to make the input visible by default:

Change the `CommandInputProps` interface and initial state:

```typescript
interface CommandInputProps {
  send: (channel: string, payload: unknown) => void;
  subscribe: (channel: string, handler: (msg: WSMessage) => void) => () => void;
  autoShow?: boolean;
}
```

Change `useState(false)` to `useState(autoShow ?? false)` and add effect:

```typescript
export function CommandInput({ send, autoShow = false }: CommandInputProps) {
  const [visible, setVisible] = useState(autoShow);
```

- [ ] **Step 2: In App.tsx, pass autoShow=true**

Change the CommandInput usage in App.tsx:

```tsx
<CommandInput send={send} subscribe={subscribe} autoShow={true} />
```

- [ ] **Step 3: Verify it compiles**

```bash
cd packages/gui
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/gui/src/components/CommandInput.tsx packages/gui/src/App.tsx
git commit -m "feat(gui): show command input by default for interactive mode"
```
