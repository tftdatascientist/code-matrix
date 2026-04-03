# Plan na następną sesję — Multi-Session + UI Redesign

> Ten dokument to kontekst dla Claude po wyczyszczeniu okna kontekstowego.
> Przeczytaj go na początku sesji.

---

## Stan projektu (2026-04-03)

Projekt code-matrix działa. Bridge spawnuje Claude Code przez `node-pty` (via `cmd.exe /c chcp 65001 >nul & claude`), GUI w przeglądarce wyświetla terminal przez xterm.js, komendy z GUI trafiają do Claude stdin. Wszystkie fazy 0-5 ukończone + dodano node-pty bidirectional.

### Kluczowe pliki:
- `packages/bridge/src/pty-spawner.ts` — spawnuje claude przez node-pty
- `packages/bridge/src/index.ts` — orchestrator, czyta .env, tworzy PtySpawner lub PtyReader
- `packages/bridge/src/ws-server.ts` — WebSocket server, kanały, replay buffer
- `packages/bridge/src/command-router.ts` — routing komend z GUI do PTY stdin (używa `\r` nie `\n`)
- `packages/bridge/src/session-parser.ts` — regex parsing metryk z ANSI
- `packages/gui/src/App.tsx` — root layout
- `packages/gui/src/hooks/useTerminal.ts` — xterm.js, base64→Uint8Array→write
- `packages/gui/src/hooks/useWebSocket.ts` — WS connection, subscribe/send
- `packages/gui/src/components/CommandInput.tsx` — pole do wpisywania komend (Enter=submit)
- `packages/gui/src/components/SessionPanel.tsx` — panel boczny z metrykami
- `packages/gui/src/styles/global.css` — cały CSS, panel po lewej (flex-direction: row-reverse)
- `.env` — config: MATRIX_PTY_SOURCE=node-pty, MATRIX_PTY_ARGS=--dangerously-skip-permissions
- `scripts/matrix.ps1` — launcher, używa `npm run dev` (concurrently bridge+gui)

### Ważne fixy z tej sesji:
- Windows: `cmd.exe /c` dla .cmd wrapperów (npm, claude)
- `chcp 65001` dla UTF-8 w conpty
- `Uint8Array` zamiast string w atob→xterm (root cause encoding)
- `\r` zamiast `\n` w command-router (PTY oczekuje CR nie LF)
- PowerShell 5.1: `[char]27` zamiast `` `e ``, `$procId` zamiast `$pid`
- `dotenv` ładuje `.env` z roota projektu (3 levels up od src/)

---

## Co trzeba zrobić

### 1. Multi-Session (2 instancje CC obok siebie)

**Decyzje podjęte:**
- Oddzielne katalogi robocze per instancja
- Sposób wyboru katalogów: **do ustalenia z userem** (env, GUI dialog, lub argumenty CLI)
- Jedno uruchomienie `cm`, jeden bridge, jeden port WS
- Kanały WS z indeksem: `terminal:data:0`, `terminal:data:1` itd.

**Architektura:**
- Bridge zarządza tablicą sesji `PtySpawner[]`
- Każda sesja ma swój indeks, CWD, proces claude
- WS server multipleksuje dane po indeksie sesji
- GUI renderuje dwa `TerminalMirror` obok siebie pionowo
- Konfiguracja: `MATRIX_SESSION_COUNT=2`, `MATRIX_SESSION_0_CWD=...`, `MATRIX_SESSION_1_CWD=...`

### 2. Przebudowa panelu bocznego

**Kontekst:** User ma już 8 parametrów na pasku w klasycznym terminalu (patrz `files/m.png`):
- Model: Opus 4.6
- Ctx: 0.0%
- Session: 32.0%
- Session time: <1m
- Thinking: medium
- Cost: $0.00
- Weekly: 26.0%
- Total: 0
- bypass permissions on

**Decyzja:** Panel boczny ma wyświetlać INNE informacje niż te 8 parametrów. Szczegóły do ustalenia z userem w następnej sesji.

### 3. Komendy bezpośrednio w terminalu

**Obecny stan:** Osobny `CommandInput` textarea na dole ekranu.
**Cel:** Pisać tam gdzie jest kursor w terminalu (jak prawdziwy terminal).
**Podejście:** Zamiast CommandInput, podłączyć xterm.js `onData` event do PTY stdin. User pisze bezpośrednio w xterm.js, znaki lecą do PTY. Usunąć CommandInput.

### 4. Układ elementów GUI

Do przeprojektowania — szczegóły w następnej sesji.

---

## Screenshot referencyjny

`files/m.png` — pokazuje klasyczny terminal CC z 8 parametrami na statusbarze na dole. Widać prompt `> █`, listę skills z tokenami, i dolny pasek z info o bridge (host:7999, PTY: ON, buffer, clients).

---

## Kolejność prac (sugerowana)

1. **Komendy w terminalu** — usunąć CommandInput, podłączyć xterm.js onData → PTY stdin (najważniejsze dla UX)
2. **Multi-session** — dwa terminale, multipleksowanie kanałów WS
3. **Panel boczny** — redesign z nową zawartością (ustalić z userem)
4. **Układ GUI** — finalne rozmieszczenie elementów
