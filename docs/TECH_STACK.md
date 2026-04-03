# TECH STACK — Matrix GUI

## Core Technologies

### GUI Application

| Technologia | Wersja | Rola |
|---|---|---|
| **Electron** | 33+ | Frameless window, always-on-top, system tray, opacity control |
| **React 18** | 18.3+ | UI framework, hooks, component model |
| **TypeScript** | 5.5+ | Type safety across WS protocol and session metrics |
| **Vite** | 6+ | Dev server + bundler |
| **xterm.js** | 5.5+ | Terminal renderer (same engine as VS Code) |
| **xterm-addon-fit** | 0.10+ | Auto-fit terminal to container |
| **xterm-addon-webgl** | 0.18+ | GPU-accelerated rendering |

### Bridge Server

| Technologia | Wersja | Rola |
|---|---|---|
| **Node.js** | 20+ LTS | Runtime for PTY capture, stream handling, WS server |
| **ws** | 8+ | Lightweight WebSocket server |
| **strip-ansi** | 7+ | Strip ANSI codes for metric parsing |
| **tsx** | 4+ | TypeScript execution (dev mode) |

### Visual Effects

| Element | Implementacja |
|---|---|
| Matrix rain | Canvas 2D, requestAnimationFrame, 30fps target |
| Glow effects | CSS `text-shadow` + `box-shadow` |
| Scanlines | CSS `repeating-linear-gradient` pseudo-element |
| Vignette | CSS `radial-gradient` overlay |
| Flicker | CSS `@keyframes` opacity jitter (8s cycle) |
| State effects | React state → rain speed/density + brightness flash |

### Fonts

| Font | Source | Usage |
|---|---|---|
| Share Tech Mono | Google Fonts | Panel labels, status bar, headers |
| Fira Code | Google Fonts | Terminal mirror, metric values |

---

## Project Structure (actual)

```
code-matrix/
├── CLAUDE.md                     # Project router
├── README.md                     # Public documentation
├── package.json                  # Workspace root (npm workspaces)
├── tsconfig.base.json            # Shared TS config
├── .env.example                  # Environment template
├── .gitignore
│
├── docs/
│   ├── ARCHITECTURE.md           # System design + data flow
│   ├── TECH_STACK.md             # ← this file
│   ├── UI_DESIGN.md              # Visual spec + component details
│   ├── PROTOCOL.md               # WebSocket protocol + session parser
│   ├── IMPLEMENTATION_PLAN.md    # Phase tracking (all phases complete)
│   └── FUTURE_CONTROL.md         # Command input architecture
│
├── packages/
│   ├── bridge/                   # Bridge Server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # Orchestrator
│   │       ├── pty-reader.ts     # PTY/pipe stream reader (pipe + stdin)
│   │       ├── ws-server.ts      # WebSocket server + replay buffer + heartbeat
│   │       ├── session-parser.ts # Regex metric extraction from ANSI stream
│   │       └── command-router.ts # Gated command input handler
│   │
│   └── gui/                      # Electron + React GUI
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── electron/
│       │   ├── main.js           # Frameless window, tray, opacity
│       │   └── preload.js        # Context bridge
│       └── src/
│           ├── App.tsx           # Root layout + state effects
│           ├── main.tsx          # React entry
│           ├── hooks/
│           │   ├── useWebSocket.ts      # WS connection + auto-reconnect
│           │   ├── useTerminal.ts       # xterm.js instance + data feed
│           │   └── useSessionMetrics.ts # Metrics state management
│           ├── components/
│           │   ├── TerminalMirror.tsx    # xterm.js wrapper
│           │   ├── SessionPanel.tsx     # Metrics sidebar
│           │   ├── ProgressBar.tsx      # Unicode block progress bars
│           │   ├── MatrixRain.tsx       # Canvas 2D rain engine
│           │   ├── CRTOverlay.tsx       # Scanlines + vignette + flicker
│           │   └── CommandInput.tsx     # Hidden command input (Ctrl+/)
│           ├── styles/
│           │   └── global.css           # Full theme + layout + animations
│           └── types/
│               ├── protocol.ts          # WS message types
│               ├── session.ts           # Metrics + state types
│               └── terminal.ts          # Connection + dimensions types
│
└── scripts/
    ├── capture-with-script.sh    # PTY capture (Unix script / Windows tee)
    ├── start-bridge.sh           # Start bridge server
    └── start-gui.sh              # Start Vite dev server
```

---

## Environment Variables

```env
# Bridge Server
MATRIX_WS_PORT=7999
MATRIX_PTY_SOURCE=pipe              # pipe | stdin
# MATRIX_PTY_PIPE=                  # auto-detected from os.tmpdir()
MATRIX_BUFFER_SIZE=10000            # chunks to buffer for reconnect replay

# GUI (used by Electron main process)
MATRIX_WS_URL=ws://localhost:7999
MATRIX_ALWAYS_ON_TOP=true
MATRIX_OPACITY=0.95

# Future Control
MATRIX_COMMAND_ENABLED=false        # set to true to enable command input
```
