# 📡 PROTOCOL — Komunikacja Terminal → GUI

## Przegląd

Komunikacja opiera się na WebSocket z prostym systemem kanałów (channels). Każda wiadomość to JSON z polem `channel` i `payload`.

---

## Format wiadomości

```typescript
interface WSMessage {
  channel: string;      // np. "terminal:data", "session:metrics"
  timestamp: number;    // Unix ms
  payload: unknown;     // zależne od channel
}
```

---

## Kanały

### `terminal:data` — surowy output terminala

**Kierunek:** Server → Client
**Częstotliwość:** Real-time streaming (każdy chunk z PTY)

```typescript
interface TerminalDataPayload {
  data: string;         // raw bytes encoded as base64
  encoding: 'base64';   // zawsze base64 (binary-safe)
}
```

**Client handling:** Dekoduj base64 → `terminal.write(decoded)` w xterm.js.

Dlaczego base64 a nie raw text? Output terminala zawiera ANSI escape codes z bajtami poza ASCII. Base64 gwarantuje bezstratny transport przez JSON.

### `terminal:resize` — synchronizacja rozmiaru terminala

**Kierunek:** Bidirectional

```typescript
interface TerminalResizePayload {
  cols: number;
  rows: number;
}
```

Server emituje resize gdy zmieni się terminal w VS Code. Client emituje resize gdy użytkownik zmieni rozmiar okna GUI (przyszłość: gdy GUI kontroluje terminal).

### `session:metrics` — metryki sesji Claude Code

**Kierunek:** Server → Client
**Częstotliwość:** Na każdą zmianę metryki (typowo co kilka sekund)

```typescript
interface SessionMetrics {
  model: string | null;          // "Opus 4.6", "Sonnet 4.6", etc.
  contextPercent: number | null; // 0.0 - 100.0
  sessionPercent: number | null; // 0.0 - 100.0
  sessionTime: string | null;    // "<1m", "5m", "1h 23m"
  thinkingMode: string | null;   // "low", "medium", "high"
  cost: number | null;           // w USD, np. 0.00, 1.23
  weeklyPercent: number | null;  // 0.0 - 100.0
  totalTokens: number | null;    // integer
  bypassPermissions: boolean;    // true = bypass ON
}
```

**Null handling:** Metryka = null oznacza "nie udało się odczytać" lub "brak w output". GUI wyświetla `—` lub ostatnią znaną wartość.

### `session:state` — stan aktywności CC

**Kierunek:** Server → Client
**Częstotliwość:** Na zmianę stanu

```typescript
interface SessionState {
  status: 'idle' | 'thinking' | 'writing' | 'executing' | 'error' | 'disconnected';
  detail?: string;       // np. "bash command", "file edit", nazwa narzędzia
}
```

**Wykrywanie stanu** (heurystyki w session-parser):
- `idle`: CC wyświetla prompt, czeka na input
- `thinking`: CC emituje spinner/progress indicators
- `writing`: CC emituje tekst odpowiedzi (streaming)
- `executing`: CC uruchamia tool (bash, file write, etc.)
- `error`: CC wyświetla error message

### `system:health` — health check

**Kierunek:** Server → Client
**Częstotliwość:** Co 1s (heartbeat)

```typescript
interface SystemHealth {
  uptime: number;          // seconds
  ptyConnected: boolean;   // czy PTY source jest aktywne
  wsClients: number;       // ile GUI klientów podłączonych
  bufferSize: number;      // ile linii w buforze replay
  latency: number;         // last measured roundtrip ms
}
```

### `command:input` — 🔒 sterowanie z GUI (FUTURE)

**Kierunek:** Client → Server
**Status:** DISABLED by default, patrz `FUTURE_CONTROL.md`

```typescript
interface CommandInput {
  type: 'text' | 'interrupt' | 'confirm';
  text?: string;           // dla type='text'
  // type='interrupt' → Ctrl+C
  // type='confirm' → Enter (np. na y/n prompt)
}
```

---

## Session Parser — jak wyciągamy metryki z output CC

Claude Code wyświetla status bar w terminalu z informacjami o sesji. Parser skanuje output szukając wzorców.

### Wzorce do parsowania (regex)

```typescript
const PATTERNS = {
  // "Model: Opus 4.6 | Ctx: 24.3% | Session: 5.0% | Session: <1m"
  statusBar: /Model:\s*(.+?)\s*\|\s*Ctx:\s*([\d.]+)%\s*\|\s*Session:\s*([\d.]+)%\s*\|\s*Session:\s*(.+?)$/m,

  // "Thinking: medium | Cost: $1.23 | Weekly: 17.0% | Total: 1234"
  metricsBar: /Thinking:\s*(\w+)\s*\|\s*Cost:\s*\$([\d.]+)\s*\|\s*Weekly:\s*([\d.]+)%\s*\|\s*Total:\s*(\d+)/m,

  // "▸▸ bypass permissions on"
  bypassMode: /▸▸\s*bypass permissions\s*(on|off)/m,

  // Heurystyki stanu
  prompt: /^[❯>$]\s*$/m,                    // idle — CC czeka na input
  thinking: /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏|thinking/i,  // spinner characters
  toolUse: /\b(bash|Read|Write|Edit|Glob|Grep|TodoRead|TodoWrite)\b.*\(/,
};
```

### Strategia parsowania

1. Każdy chunk z PTY jest najpierw stripowany z ANSI codes (dla parsera metryki)
2. Regex matching na stripped text
3. Jeśli match → update SessionMetrics state → emit `session:metrics`
4. Oryginalny chunk (z ANSI!) idzie niezmieniony do `terminal:data`
5. Parser NIGDY nie modyfikuje output — jest passive observer

### Edge cases

- CC może przepisać status bar (cursor movement do top/bottom)
- Status bar może być podzielony na wiele chunków PTY
- Parser buforuje ostatnich 5 chunków i matchuje na złączonym stringu
- Niekompletny match → ignoruj, czekaj na więcej danych

---

## Reconnection Protocol

1. GUI łączy się do `ws://localhost:7999`
2. Server odpowiada `system:health` natychmiast
3. Jeśli buffer > 0, server emituje replay:
   ```typescript
   { channel: 'terminal:replay', payload: { data: '...base64...', lines: 500 } }
   ```
4. Po replay, normalny streaming `terminal:data`
5. Jeśli disconnect:
   - GUI próbuje reconnect co 2s (exponential backoff do 30s max)
   - Wyświetla "Connecting..." overlay (jak w referencji graficznej)
   - Po reconnect: automatyczny replay

---

## Troubleshooting

| Problem | Przyczyna | Rozwiązanie |
|---|---|---|
| GUI nie łączy się | Bridge server nie działa | `npm run bridge` w osobnym terminalu |
| Terminal mirror pusty | PTY source nie podłączony | Sprawdź `MATRIX_PTY_SOURCE` i czy pipe istnieje |
| Metryki nie aktualizują się | CC zmienił format status bar | Zaktualizuj regex w `session-parser.ts` |
| Opóźnienie > 100ms | Zbyt duży buffer lub CPU | Zmniejsz `MATRIX_BUFFER_SIZE`, sprawdź matrix rain fps |
| Znaki się rozjeżdżają | Mismatch rozmiaru terminala | Sprawdź sync `terminal:resize` |
