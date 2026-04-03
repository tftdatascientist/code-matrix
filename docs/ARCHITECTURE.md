# 🏗️ ARCHITECTURE — Matrix GUI System Design

## Przegląd systemu

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Terminal                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Claude Code (CC) ← użytkownik steruje stąd              │  │
│  │  $ claude --model opus                                    │  │
│  └──────────────────────┬────────────────────────────────────┘  │
│                         │ stdout/stderr (raw PTY stream)        │
│  ┌──────────────────────▼────────────────────────────────────┐  │
│  │  PTY Proxy Layer (capture bez ingerencji w terminal)      │  │
│  │  • script / tmux / node-pty wrapper                       │  │
│  └──────────────────────┬────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │ raw terminal bytes + ANSI codes
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Bridge Server (Node.js)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │ PTY Reader     │  │ ANSI Parser    │  │ Session Parser    │  │
│  │ (stream input) │→ │ (xterm decode) │→ │ (extract metrics) │  │
│  └────────────────┘  └───────┬────────┘  └────────┬──────────┘  │
│                              │                     │             │
│                     ┌────────▼─────────────────────▼──────────┐  │
│                     │          WebSocket Server               │  │
│                     │  ws://localhost:7999                     │  │
│                     │  • terminal_data channel                │  │
│                     │  • session_metrics channel               │  │
│                     │  • command_input channel (🔒 future)    │  │
│                     └────────────────────┬────────────────────┘  │
└──────────────────────────────────────────┼──────────────────────┘
                                           │ WebSocket
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Matrix GUI (Electron / Browser)                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    MATRIX RAIN OVERLAY                       │ │
│  │              (tło: spadające znaki japońskie)                │ │
│  │  ┌───────────────────────────────────────┐ ┌──────────────┐ │ │
│  │  │                                       │ │  SESSION      │ │ │
│  │  │         TERMINAL MIRROR               │ │  PANEL        │ │ │
│  │  │         (1:1 output CC)               │ │              │ │ │
│  │  │         xterm.js renderer             │ │  Model       │ │ │
│  │  │                                       │ │  Ctx %       │ │ │
│  │  │                                       │ │  Session %   │ │ │
│  │  │                                       │ │  Time        │ │ │
│  │  │                                       │ │  Thinking    │ │ │
│  │  │                                       │ │  Cost        │ │ │
│  │  │                                       │ │  Weekly %    │ │ │
│  │  │                                       │ │  Total       │ │ │
│  │  │                                       │ │  Permissions │ │ │
│  │  │                                       │ │              │ │ │
│  │  └───────────────────────────────────────┘ └──────────────┘ │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  STATUS BAR — connection status, fps, latency           │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  🔒 COMMAND INPUT (hidden/disabled, future activation)      │ │
│  │  Przygotowany komponent input z routingiem do WS            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Warstwy systemu

### Warstwa 1: PTY Capture

**Cel:** Przechwycenie CAŁEGO outputu terminala Claude Code bez ingerencji w jego działanie.

**Metody (od najprostszej):**

1. **`script` command wrapper** — najprostsza, `script -q -f /tmp/cc-pipe` loguje surowy PTY output do named pipe
2. **tmux capture-pane** — jeśli CC działa w tmux, `tmux capture-pane -p -t session` daje bieżący stan
3. **node-pty fork** — programatyczny wrapper, CC jest child processem node-pty. Pełna kontrola ale wymaga zmiany sposobu uruchamiania CC
4. **VS Code Extension API** — Terminal.onDidWriteData daje raw output terminala w VS Code

**Rekomendacja na start:** Opcja 4 (VS Code Extension) jako primary, opcja 1 (`script`) jako fallback.

### Warstwa 2: Bridge Server

**Cel:** Przetworzenie surowego streamu i dystrybucja przez WebSocket.

```
Moduły:
├── pty-reader.ts      — czyta z PTY source (pipe/extension)
├── ansi-parser.ts     — dekoduje ANSI escape codes do structured data
├── session-parser.ts  — wyciąga metryki sesji CC z output stream
├── ws-server.ts       — WebSocket server, zarządza kanałami
└── index.ts           — orchestrator
```

**Kanały WebSocket:**

| Kanał | Kierunek | Payload | Użycie |
|---|---|---|---|
| `terminal:data` | server → client | raw ANSI bytes (base64) | Feed do xterm.js |
| `terminal:resize` | bidirectional | `{cols, rows}` | Sync rozmiaru terminala |
| `session:metrics` | server → client | `{model, ctx, cost, ...}` | Panel sesji |
| `session:state` | server → client | `{status, activity}` | Stan CC (thinking/writing/idle) |
| `command:input` | client → server | `{text, type}` | 🔒 Future: sterowanie z GUI |
| `system:health` | server → client | `{latency, connected}` | Status bar |

### Warstwa 3: Matrix GUI

**Cel:** Renderowanie terminala + metryki + efekty wizualne.

Szczegóły w `UI_DESIGN.md`.

---

## Data Flow — cykl życia jednego znaku

```
1. CC pisze "Analyzing code..." do stdout
2. PTY capture przechwytuje raw bytes z ANSI escape sequences
3. Bridge Server:
   a. Przekazuje raw bytes do kanału terminal:data (bez zmian!)
   b. Równolegle: session-parser sprawdza czy output zawiera metryki
   c. Jeśli tak → emituje session:metrics z nowymi wartościami
4. GUI odbiera przez WebSocket:
   a. terminal:data → xterm.js renderuje znaki (z pełnym kolorem/formatowaniem)
   b. session:metrics → React state update → panel odświeża wartości
5. Matrix rain overlay renderuje się niezależnie w pętli animacji (requestAnimationFrame)
```

---

## Kluczowe decyzje architektoniczne

### Dlaczego xterm.js w GUI?

Terminal output CC zawiera złożone ANSI sequences — kolory, cursor movement, screen clearing. Reimplementacja parsera to błąd. xterm.js to ten sam emulator co w VS Code terminal. Podajemy mu raw bytes i dostajemy pixel-perfect rendering.

### Dlaczego osobny Bridge Server a nie direct pipe?

1. Separacja odpowiedzialności — capture, parsing, delivery to różne problemy
2. Wieloklientowość — w przyszłości wiele okien GUI
3. Bufor — jeśli GUI się rozłączy, server buforuje i replay'uje po reconnect
4. Furtka do kontroli — command channel naturalnie pasuje do server-mediated architecture

### Dlaczego Electron a nie czysta przeglądarka?

Electron daje:
- Frameless window → prawdziwy "floating overlay" look
- Always-on-top → GUI widoczne obok VS Code
- Native transparency → Matrix rain na przeźroczystym tle
- System tray integration
- **ALE**: wersja przeglądarkowa jako fallback (ten sam React code)

---

## Security considerations

- WebSocket działa TYLKO na localhost
- Command channel domyślnie WYŁĄCZONY (require explicit unlock)
- Brak external network access z GUI
- Bridge server nie modyfikuje CC output — jest transparent proxy
