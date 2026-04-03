# 🚪 FUTURE CONTROL — Furtka do sterowania CC z Matrix GUI

> **Status:** PLANOWANE. Ten dokument opisuje architekturę, która zostanie **przygotowana** w Fazie 5, ale domyślnie **wyłączona**. Celem jest nie zamykać sobie drogi do sterowania Claude Code z GUI w przyszłości.

---

## Dlaczego furtka, nie pełna implementacja?

1. Obecnie Claude Code jest zaprojektowany jako CLI — interakcja przez terminal
2. GUI na start to **okno obserwacyjne** (read-only mirror)
3. Ale architektura musi być gotowa na moment, gdy chcemy wpisać prompt z GUI
4. Wystarczy "uchylić drzwi" — reszta przyjdzie gdy będzie potrzebna

---

## Architektura Input Pipeline

```
┌──────────────────────────────────────────────────────┐
│                    Matrix GUI                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │  CommandInput.tsx                                 │ │
│  │  ┌────────────────────────────────────────────┐  │ │
│  │  │  > [input field — hidden by default]       │  │ │
│  │  │    Ctrl+/ to toggle visibility             │  │ │
│  │  └────────────────────┬───────────────────────┘  │ │
│  │                       │ { type: 'text', text }    │ │
│  └───────────────────────┼──────────────────────────┘ │
│                          │                             │
│                  WebSocket (command:input channel)      │
└──────────────────────────┼─────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────┐
│                    Bridge Server                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Command Router                                   │ │
│  │  1. Check MATRIX_COMMAND_ENABLED === true          │ │
│  │  2. Validate input (sanitize, length limit)       │ │
│  │  3. Route to PTY stdin writer                     │ │
│  └──────────────────────┬───────────────────────────┘ │
│                         │                              │
│  ┌──────────────────────▼───────────────────────────┐ │
│  │  PTY Stdin Writer                                 │ │
│  │  pty.write(text + '\n')                           │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
                           │
                           ▼
                    VS Code Terminal
                    Claude Code stdin
```

---

## Co przygotować w Fazie 5

### 1. CommandInput Component (GUI)

```tsx
// Komponent istnieje ale jest ukryty
// Ctrl+/ toggluje widoczność
// Wpisany tekst idzie na WS channel command:input
// Wizualnie: input field w stylu Matrix na dole ekranu

interface CommandInputProps {
  enabled: boolean;      // from env/config
  wsConnection: WebSocket;
}
```

**Wizualizacja (gdy włączony):**
```
┌──────────────────────────────────────────────────────────┐
│  > _                                                      │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  CTRL+ENTER to send │ ESC to hide │ 🔒 COMMAND MODE       │
└──────────────────────────────────────────────────────────┘
```

### 2. Command Router (Bridge)

```typescript
// W ws-server.ts — handler dla command:input
// Domyślnie: log warning "Command channel disabled" i ignoruj
// Gdy enabled: forward do pty stdin

if (msg.channel === 'command:input') {
  if (!config.commandEnabled) {
    log.warn('Command channel disabled. Set MATRIX_COMMAND_ENABLED=true to enable.');
    return;
  }
  // sanitize + forward
  ptyWriter.write(msg.payload.text);
}
```

### 3. PTY Stdin Writer (Bridge)

```typescript
// Moduł, który pisze do stdin PTY procesu
// Wymaga że PTY jest w trybie node-pty (nie pipe read-only)
// Alternatywa: VS Code Extension Terminal.sendText()
```

### 4. Safety Guards

```typescript
// Limity bezpieczeństwa
const COMMAND_GUARDS = {
  maxLength: 10000,        // max chars per command
  rateLimit: 10,           // max commands per minute
  blacklist: [             // zablokowane patterny
    /rm\s+-rf\s+\//,      // rm -rf /
    /sudo\s+/,            // sudo
    />\s*\/dev\//,         // write to /dev/
  ],
  requireConfirm: true,    // GUI pokazuje "Are you sure?" przed wysłaniem
};
```

---

## Trzy ścieżki aktywacji (do wyboru w przyszłości)

### Ścieżka A: Direct PTY (node-pty)
- CC uruchamiany jako child process bridge servera
- Bridge ma pełny dostęp do stdin/stdout
- **Pros:** pełna kontrola, najniższy latency
- **Cons:** zmiana sposobu uruchamiania CC

### Ścieżka B: VS Code Extension
- Extension używa `Terminal.sendText()` do wpisywania w terminal CC
- Bridge komunikuje się z Extension przez local HTTP/WS
- **Pros:** CC dalej uruchamiany normalnie w VS Code
- **Cons:** dodatkowa warstwa, zależność od VS Code API

### Ścieżka C: tmux send-keys
- CC działa w sesji tmux
- Bridge używa `tmux send-keys` do wpisywania
- **Pros:** prostota, zero code w VS Code
- **Cons:** wymaga tmux, mniej eleganckie

**Rekomendacja:** Przygotować interfejs pod Ścieżkę B (VS Code Extension) jako primary, z fallbackiem na C (tmux).

---

## Przyszłe rozszerzenia (poza Fazą 5)

- **Prompt templates** — predefiniowane prompty dostępne z GUI
- **Quick actions** — przyciski: "Approve (y)", "Cancel (Ctrl+C)", "Continue"
- **Prompt history** — historia wpisanych komend z GUI
- **Multi-session** — obserwacja kilku instancji CC jednocześnie
- **Macros** — sekwencje komend odpalane jednym kliknięciem
- **Voice input** — speech-to-text do CC (integracja z ElevenLabs?)
- **Mobile companion** — PWA wersja GUI na telefon (observe only)
