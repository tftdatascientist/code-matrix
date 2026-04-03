# Matrix GUI — Claude Code Terminal Visualizer

Real-time Matrix-themed visualizer for Claude Code terminal sessions. Watch your AI coding assistant work through a cyberpunk lens — falling katakana, CRT scanlines, green phosphor glow, and live session metrics.

## Features

- **Terminal Mirror** — pixel-perfect 1:1 rendering of Claude Code output via xterm.js + WebGL
- **Session Metrics Panel** — live Model, Context%, Session%, Cost, Weekly usage, Thinking mode
- **Matrix Rain** — Canvas 2D falling characters (katakana + digits), speed reacts to CC state
- **CRT Effects** — scanlines, vignette, subtle flicker overlay
- **State-driven FX** — thinking speeds up rain, executing triggers flash, disconnect dims everything
- **Electron App** — frameless, always-on-top, adjustable opacity, system tray
- **Command Furtka** — hidden input (Ctrl+/) for future GUI-to-terminal control (disabled by default)

## Quick Start

```bash
# Install dependencies
npm install

# Terminal 1: Capture Claude Code output
./scripts/capture-with-script.sh

# Terminal 2: Start bridge + GUI
npm run dev
```

Or run components separately:

```bash
npm run dev:bridge   # WebSocket server on :7999
npm run dev:gui      # Vite dev server on :5173
```

### Electron (desktop app)

```bash
cd packages/gui
npm run dev:electron
```

### Keyboard Shortcuts (Electron)

| Shortcut | Action |
|---|---|
| `Ctrl+=` / `Ctrl+-` | Increase / decrease opacity |
| `Ctrl+0` | Reset opacity to 95% |
| `Ctrl+T` | Toggle always-on-top |
| `Ctrl+/` | Toggle command input (disabled by default) |

## Architecture

```
VS Code Terminal (Claude Code)
        │ stdout/stderr
        ▼
  PTY Capture (script / tee)
        │ raw bytes + ANSI
        ▼
  Bridge Server (Node.js, :7999)
  ├── pty-reader     → reads PTY stream
  ├── session-parser → extracts metrics via regex
  ├── ws-server      → WebSocket channels
  └── command-router → input furtka (disabled)
        │ WebSocket
        ▼
  Matrix GUI (React + Electron)
  ├── TerminalMirror → xterm.js rendering
  ├── SessionPanel   → live metrics display
  ├── MatrixRain     → Canvas 2D rain engine
  ├── CRTOverlay     → scanlines + vignette
  └── CommandInput   → hidden input (Ctrl+/)
```

### WebSocket Channels

| Channel | Direction | Description |
|---|---|---|
| `terminal:data` | server → client | Raw PTY output (base64) |
| `terminal:replay` | server → client | Buffer replay on reconnect |
| `terminal:resize` | bidirectional | Terminal dimensions sync |
| `session:metrics` | server → client | Parsed CC session metrics |
| `session:state` | server → client | CC activity state |
| `system:health` | server → client | Heartbeat (1s interval) |
| `command:input` | client → server | GUI input (disabled by default) |

## Project Structure

```
packages/
  bridge/src/
    index.ts           — orchestrator
    pty-reader.ts      — PTY stream reader (pipe/stdin)
    ws-server.ts       — WebSocket server + replay buffer
    session-parser.ts  — regex metric extraction from ANSI stream
    command-router.ts  — gated command input handler
  gui/src/
    App.tsx            — main layout + state effects
    hooks/
      useWebSocket.ts      — WS connection + auto-reconnect
      useTerminal.ts       — xterm.js instance management
      useSessionMetrics.ts — metrics state from WS
    components/
      TerminalMirror.tsx   — xterm.js wrapper
      SessionPanel.tsx     — metrics + permissions + activity
      ProgressBar.tsx      — Unicode block progress bars
      MatrixRain.tsx       — Canvas 2D rain engine
      CRTOverlay.tsx       — scanlines + vignette + flicker
      CommandInput.tsx     — hidden command input
    styles/global.css    — Matrix theme, layout, animations
  gui/electron/
    main.js            — frameless window, tray, opacity
    preload.js         — context bridge
scripts/
  capture-with-script.sh — PTY capture wrapper
docs/
  ARCHITECTURE.md    — system design
  PROTOCOL.md        — WebSocket protocol spec
  UI_DESIGN.md       — visual specification
  IMPLEMENTATION_PLAN.md — phase tracking
  FUTURE_CONTROL.md  — command input architecture
```

## Configuration

Copy `.env.example` to `.env`:

```bash
MATRIX_WS_PORT=7999
MATRIX_PTY_SOURCE=pipe              # pipe | stdin
# MATRIX_PTY_PIPE=                  # auto-detected from os.tmpdir()
MATRIX_BUFFER_SIZE=10000
MATRIX_COMMAND_ENABLED=false         # set to true to enable command input
```

## Tech Stack

- **Bridge:** Node.js, TypeScript, ws, strip-ansi
- **GUI:** React 18, Vite, xterm.js (WebGL), Electron
- **Fonts:** Share Tech Mono, Fira Code (Google Fonts)
- **Monorepo:** npm workspaces

## License

MIT
