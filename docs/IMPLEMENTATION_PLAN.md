# 📋 IMPLEMENTATION PLAN — Matrix GUI

## Fazy projektu

Projekt jest podzielony na 5 faz. Każda faza ma jasno zdefiniowane cele i "definition of done".

---

## Faza 0: Scaffold & Toolchain 🏗️

**Cel:** Działająca struktura projektu, build pipeline, devtools.

### Zadania

- [x] Inicjalizacja monorepo (npm workspaces) (2026-04-03)
- [x] Setup `packages/bridge` — TypeScript, tsx watch mode (2026-04-03)
- [x] Setup `packages/gui` — Vite + React + Electron (2026-04-03)
- [x] Konfiguracja TypeScript (tsconfig.base + per-package extends) (2026-04-03)
- [x] Shared types w `packages/gui/src/types/` (SessionMetrics, WSMessage, etc.) (2026-04-03)
- [x] Skrypty startowe (`scripts/start-bridge.sh`, `scripts/start-gui.sh`) (2026-04-03)
- [x] `.gitignore`, `.env.example` (2026-04-03)
- [x] README.md z quick start (2026-04-03)

### Definition of Done
> `npm run dev` w root uruchamia bridge + GUI. Electron okno otwiera się i wyświetla "Matrix GUI — Waiting for connection...". Bridge loguje "WebSocket server listening on :7999".

---

## Faza 1: Terminal Capture & Bridge 🔌

**Cel:** Przechwytywanie output CC z terminala VS Code i streamowanie przez WebSocket.

### Zadania

- [x] Implementacja `pty-reader.ts` — odczyt z named pipe (cross-platform tmpdir) (2026-04-03)
- [x] Skrypt `capture-with-script.sh` — wrapper `script` do przechwytywania PTY (2026-04-03)
- [x] Implementacja `ws-server.ts` — WebSocket server z kanałami (2026-04-03)
- [x] Kanał `terminal:data` — streaming base64-encoded chunks (2026-04-03)
- [x] Kanał `system:health` — heartbeat co 1s (2026-04-03)
- [x] Reconnection buffer — przechowywanie ostatnich N linii dla replay (2026-04-03)
- [x] Test: manualny echo → pipe → WS → sprawdzenie w browser DevTools (2026-04-03)

### Sposób uruchomienia na start (najprostszy)

```bash
# Terminal 1: CC z przechwytywaniem
script -q -f /tmp/cc-matrix-pipe bash -c "claude"

# Terminal 2: Bridge server
cd packages/bridge && npm run dev

# Terminal 3: GUI
cd packages/gui && npm run dev
```

### Definition of Done
> Tekst wpisany w terminalu z CC pojawia się w konsoli przeglądarki (lub w prostym textarea w GUI) przez WebSocket. Reconnect po rozłączeniu działa z replay buffera.

---

## Faza 2: Terminal Mirror (xterm.js) 🖥️

**Cel:** Pixel-perfect rendering output CC w oknie GUI.

### Zadania

- [x] Instalacja i konfiguracja `@xterm/xterm` w GUI (2026-04-03)
- [x] Komponent `TerminalMirror.tsx` — wrapper wokół xterm.js (2026-04-03)
- [x] Hook `useWebSocket.ts` — zarządzanie połączeniem WS, auto-reconnect (2026-04-03)
- [x] Hook `useTerminal.ts` — feed danych z WS do xterm.js instance (2026-04-03)
- [x] Matrix theme dla xterm.js (green phosphor palette) (2026-04-03)
- [x] WebGL addon dla wydajności (2026-04-03)
- [x] Fit addon — auto-resize terminala do kontenera (2026-04-03)
- [x] Sync rozmiaru terminala (kanał `terminal:resize`) (2026-04-03)
- [x] Auto-scroll + manual scroll override (2026-04-03)
- [x] Electron frameless window setup (basic) (2026-04-03)

### Definition of Done
> Output Claude Code (z kolorami, formatowaniem, spinnerami) renderuje się 1:1 w oknie Electron. Resize okna resizuje terminal. Scrollback działa.

---

## Faza 3: Session Panel & Metrics 📊

**Cel:** Statyczny panel z live metrykani sesji CC.

### Zadania

- [x] Implementacja `session-parser.ts` — regex extraction z terminal output (2026-04-03)
- [x] Kanał `session:metrics` — emisja sparsowanych metryk (2026-04-03)
- [x] Kanał `session:state` — detekcja stanu CC (idle/thinking/writing/executing) (2026-04-03)
- [x] Komponent `SessionPanel.tsx` — layout metryk (2026-04-03)
- [x] Hook `useSessionMetrics.ts` — state management dla metryk (2026-04-03)
- [x] Progress bary (Unicode blocks) z kolorami progowymi (2026-04-03)
- [x] Animacje zmiany wartości (CSS transition) (2026-04-03)
- [x] Sekcja Permissions (bypass on/off indicator) (2026-04-03)
- [x] Sekcja Activity (status CC z pulsującym indicatorem) (2026-04-03)
- [x] Komponent `StatusBar.tsx` — connection status, latency, fps (2026-04-03)

### Definition of Done
> Podczas pracy CC, panel obok terminala wyświetla bieżące: Model, Ctx%, Session%, Time, Thinking mode, Cost, Weekly%, Total, Permissions. Wartości aktualizują się w real-time. Status bar pokazuje connection health.

---

## Faza 4: Matrix Effects & Polish ✨

**Cel:** Pełna estetyka Matrix — rain, CRT, glow, animacje stanowe.

### Zadania

- [x] Komponent `MatrixRain.tsx` — Canvas 2D rain engine (2026-04-03)
  - [x] Spadające katakana + cyfry kolumnami (2026-04-03)
  - [x] Gradient head→tail per kolumna (2026-04-03)
  - [x] Losowe flash/brightness spikes (2026-04-03)
  - [x] Konfigurowalny speed + density (2026-04-03)
  - [x] Performance: target 30fps, nie blokujący terminal rendering (2026-04-03)
- [x] Komponent `CRTOverlay.tsx` — post-processing (2026-04-03)
  - [x] Scanlines (CSS repeating gradient) (2026-04-03)
  - [x] Vignette (radial gradient ciemne rogi) (2026-04-03)
  - [x] Subtle flicker (CSS keyframes) (2026-04-03)
  - [x] Screen curvature (opcjonalne, CSS transform) — pominięte, zbyt inwazyjne
- [x] Glow effects na panelu sesji i terminalu (box-shadow, text-shadow) (2026-04-03)
- [x] Stanowe efekty: (2026-04-03)
  - [x] Thinking → matrix rain przyspiesza, glow narasta (2026-04-03)
  - [x] Executing → flash/glitch effect (2026-04-03)
  - [x] Disconnect → screen dim, "Connecting..." overlay (2026-04-03)
- [x] Loading screen (initial connection) — "Connecting..." z progress barem (2026-04-03)
- [x] Typography: import Share Tech Mono + Fira Code (2026-04-03)
- [x] Final color tuning i coherence check (2026-04-03)
- [x] Electron: always-on-top, opacity control, system tray icon (2026-04-03)

### Definition of Done
> GUI wygląda jak terminal z Matrixa. Spadające znaki, zielona poświata, scanlines, pulsujące metryki. Różne stany CC wywołują różne efekty wizualne. Zrzut ekranu jest nie do odróżnienia od filmowego terminala.

---

## Faza 5: Future-Proofing & Control Furtka 🚪

**Cel:** Przygotowanie infrastruktury do przyszłego sterowania CC z GUI.

### Zadania

- [x] Komponent `CommandInput.tsx` — ukryty/zablokowany input (2026-04-03)
- [x] WS kanał `command:input` — routing w bridge (disabled by default) (2026-04-03)
- [x] Bridge: stdin writer do PTY (gdy enabled) (2026-04-03)
- [x] Config flag `MATRIX_COMMAND_ENABLED` z bezpiecznym unlock (2026-04-03)
- [x] Keyboard shortcut w GUI do show/hide command input (2026-04-03)
- [x] Dokumentacja w `FUTURE_CONTROL.md` jak aktywować i rozszerzyć (2026-04-03)
- [ ] Opcjonalnie: VS Code Extension scaffolding z `Terminal.sendText()` — odłożone

### Definition of Done
> `CommandInput` komponent istnieje, jest ukryty, ma routing do WS. Ustawienie `MATRIX_COMMAND_ENABLED=true` w `.env` pozwala wpisać tekst w GUI i zobaczyć go w terminalu CC. Domyślnie wyłączone.

---

## Priorytety i zależności

```
Faza 0 ──→ Faza 1 ──→ Faza 2 ──→ Faza 3
                                     │
                                     ├──→ Faza 4 (równolegle z końcówką Fazy 3)
                                     │
                                     └──→ Faza 5 (po Fazie 3, niezależne od Fazy 4)
```

---

## Tracking postępu

Po zakończeniu każdego zadania, zmień `- [ ]` na `- [x]` i dodaj datę:

```
- [x] Setup monorepo (2026-04-03)
```

Aktualny postęp sprawdzaj ZAWSZE na początku sesji Claude Code.
