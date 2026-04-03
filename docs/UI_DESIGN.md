# 🎨 UI DESIGN — Matrix GUI Visual Specification

## Filozofia designu

**To nie jest terminal z zielonym textem.** To jest okno do cyfrowej rzeczywistości, w której Claude Code operuje. Każdy piksel musi oddawać atmosferę Matrixa — poczucie obserwowania maszyny, która pracuje.

Referencje wizualne:
- Matrix digital rain (spadające japońskie znaki)
- Stare terminale CRT z zielonym fosforescencyjnym ekranem
- DOS CLI z lat 90/2000 (patrz: obrazek `e0eaa1ff...webp` z formatowaniem dysku)
- "Connecting..." loading screen z progress barem (patrz: `200w.webp`)

---

## Paleta kolorów

```css
:root {
  /* Matrix Greens — hierarchia jasności */
  --matrix-green-100: #00FF41;    /* najjaśniejszy — aktywne elementy, świecące znaki */
  --matrix-green-80:  #00CC33;    /* primary text, kluczowe wartości */
  --matrix-green-60:  #009926;    /* secondary text, etykiety */
  --matrix-green-40:  #006619;    /* subtle text, tło znaków rain */
  --matrix-green-20:  #003D0F;    /* najciemniejszy — shadows, borders */

  /* Accenty */
  --matrix-amber:     #FFB800;    /* ostrzeżenia, ważne wartości (jak Session time) */
  --matrix-red:       #FF3333;    /* errory, critical states */
  --matrix-cyan:      #00D4FF;    /* informacyjne, linki */
  --matrix-white:     #E0E0E0;    /* rzadko — wyjątkowe podkreślenie */

  /* Tła */
  --bg-void:          #000000;    /* czysta czerń — main background */
  --bg-panel:         #0A0A0A;    /* panel background — prawie czarny */
  --bg-terminal:      #050505;    /* terminal area — między void a panel */
  --bg-glow:          rgba(0, 255, 65, 0.03); /* ambient green glow */

  /* Efekty */
  --glow-green:       0 0 10px rgba(0, 255, 65, 0.5), 0 0 20px rgba(0, 255, 65, 0.2);
  --glow-green-intense: 0 0 10px rgba(0, 255, 65, 0.8), 0 0 40px rgba(0, 255, 65, 0.3), 0 0 80px rgba(0, 255, 65, 0.1);
  --glow-amber:       0 0 10px rgba(255, 184, 0, 0.5);
}
```

---

## Typografia

| Zastosowanie | Font | Size | Styl |
|---|---|---|---|
| Terminal mirror | `"Fira Code", "Cascadia Code", monospace` | 13px | Regular, ligatury ON |
| Session panel — wartości | `"Share Tech Mono", "Fira Code", monospace` | 14px | Regular |
| Session panel — etykiety | `"Share Tech Mono", monospace` | 11px | Uppercase, letter-spacing: 2px |
| Status bar | `"Share Tech Mono", monospace` | 10px | Regular |
| Matrix rain | `"MS Gothic", "Hiragino Kaku Gothic", monospace` | variable 10-18px | — |
| Headers / tytuły | `"Share Tech Mono", monospace` | 16px | Uppercase, glow |

---

## Layout — Master Grid

```
┌──────────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░ MATRIX RAIN BACKGROUND ░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░                                                                  ░ │
│ ░  ┌─────────────────────────────────────┬──────────────────────┐  ░ │
│ ░  │                                     │    SESSION PANEL     │  ░ │
│ ░  │                                     │                      │  ░ │
│ ░  │        TERMINAL MIRROR              │  ┌────────────────┐  │  ░ │
│ ░  │        (flex: 1, min 60%)           │  │ Model  Opus4.6 │  │  ░ │
│ ░  │                                     │  │ Ctx      0.0%  │  │  ░ │
│ ░  │                                     │  │ Session  5.0%  │  │  ░ │
│ ░  │                                     │  │ Time     < 1m  │  │  ░ │
│ ░  │                                     │  │ Think  medium  │  │  ░ │
│ ░  │                                     │  │ Cost    $0.00  │  │  ░ │
│ ░  │                                     │  │ Weekly  17.0%  │  │  ░ │
│ ░  │                                     │  │ Total       0  │  │  ░ │
│ ░  │                                     │  └────────────────┘  │  ░ │
│ ░  │                                     │                      │  ░ │
│ ░  │                                     │  ┌────────────────┐  │  ░ │
│ ░  │                                     │  │ PERMISSIONS    │  │  ░ │
│ ░  │                                     │  │ ▸▸ bypass: ON  │  │  ░ │
│ ░  │                                     │  └────────────────┘  │  ░ │
│ ░  │                                     │                      │  ░ │
│ ░  │                                     │  ┌────────────────┐  │  ░ │
│ ░  │                                     │  │ ACTIVITY       │  │  ░ │
│ ░  │                                     │  │ ● thinking...  │  │  ░ │
│ ░  │                                     │  └────────────────┘  │  ░ │
│ ░  └─────────────────────────────────────┴──────────────────────┘  ░ │
│ ░                                                                  ░ │
│ ░  ┌────────────────────────────────────────────────────────────┐  ░ │
│ ░  │ ● CONNECTED  │  ws://localhost:7999  │  12ms  │  60fps    │  ░ │
│ ░  └────────────────────────────────────────────────────────────┘  ░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────────────────────────────┘
```

**Proporcje:** Terminal 70% / Session Panel 30% (resizable w przyszłości)

---

## Komponenty — specyfikacja wizualna

### 1. Matrix Rain Background

- **Canvas layer** za wszystkimi elementami (z-index: 0)
- Znaki: katakana (ア-ン), cyfry arabskie, losowe symbole
- Spadają kolumnami z różną prędkością (20-80px/s)
- Każdy znak ma "ogon" — gradient jasności od `--matrix-green-100` (head) do `--matrix-green-20` (tail, 8-15 znaków)
- **Opacity: 0.15-0.25** żeby nie przeszkadzać w czytaniu terminala
- Losowe "flash" — pojedynczy znak rozbłyskuje biało na 100ms
- **Performance:** Canvas 2D, nie DOM. Renderowane w requestAnimationFrame. Target: 30fps dla rain (terminal rendering osobno w 60fps)

### 2. Terminal Mirror

- **xterm.js** instance z custom theme:
  ```js
  {
    background: 'transparent',        // widoczny matrix rain pod spodem
    foreground: '#00FF41',
    cursor: '#00FF41',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(0, 255, 65, 0.3)',
    black: '#000000',
    green: '#00FF41',
    brightGreen: '#00FF41',
    yellow: '#FFB800',
    red: '#FF3333',
    cyan: '#00D4FF',
    white: '#E0E0E0',
  }
  ```
- **Border:** 1px solid `--matrix-green-40` z `box-shadow: var(--glow-green)`
- **Scrollback:** 10000 lines
- Auto-scroll to bottom (with manual override)
- Font: Fira Code 13px, ligatury enabled

### 3. Session Panel

Wygląd inspirowany terminalem DOS/CRT z referencyjnych obrazków.

**Każda metryka jako para etykieta + wartość:**

```
 ┌──────────────────────┐
 │  M O D E L           │  ← etykieta: --matrix-green-60, 11px, uppercase, spaced
 │  Opus 4.6            │  ← wartość:  --matrix-green-100, 14px, glow effect
 │                      │
 │  C O N T E X T       │
 │  ████░░░░░░ 24.3%    │  ← progress bar + wartość liczbowa
 │                      │
 │  S E S S I O N       │
 │  █░░░░░░░░░  5.0%    │
 │                      │
 │  T I M E             │
 │  < 1m                │  ← --matrix-amber gdy > 30min
 │                      │
 │  T H I N K I N G     │
 │  medium              │  ← kolorowanie: low=green, medium=amber, high=red
 │                      │
 │  C O S T             │
 │  $0.00               │  ← --matrix-amber gdy > $1, --matrix-red gdy > $5
 │                      │
 │  W E E K L Y         │
 │  █████████░ 87.0%    │  ← --matrix-red gdy > 90%
 │                      │
 │  T O T A L           │
 │  0                   │
 │                      │
 │ ─────────────────── │
 │  P E R M I S S I O N │
 │  ▸▸ BYPASS: ON       │  ← pulsujący glow gdy ON
 └──────────────────────┘
```

**Progress bary:**
- Bloki Unicode: `█` (filled) i `░` (empty)
- 10 bloków szerokości
- Kolory progowe: 0-60% green, 60-85% amber, 85-100% red
- Animacja zmiany wartości: płynne przejście CSS (0.5s ease)

### 4. Status Bar

```
● CONNECTED  │  ws://localhost:7999  │  latency: 12ms  │  60fps  │  buffer: 0
```

- Dot indicator: pulsujący green = connected, static red = disconnected
- Separator: `│` w `--matrix-green-40`
- Na disconnect: "Reconnecting..." z animowanymi kropkami + progress bar jak w referencji (200w.webp)

### 5. CRT Overlay (post-processing)

Nałożone na CAŁY ekran jako `pointer-events: none` overlay:

```css
/* Scanlines */
.crt-scanlines::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    transparent 0px,
    rgba(0, 0, 0, 0.15) 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 9999;
}

/* Subtle screen flicker */
@keyframes flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.96; }
  94% { opacity: 1; }
}

/* Vignette — ciemniejsze rogi */
.crt-vignette::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%);
  pointer-events: none;
}
```

---

## Stany wizualne

### CC jest idle (czeka na input)
- Kursor w terminalu miga
- Matrix rain w normalnym tempie
- Session panel — wartości statyczne

### CC myśli (thinking)
- Activity indicator: `● thinking` pulsuje
- Matrix rain przyspiesza o 30%
- Subtle green ambient glow na border terminala narasta

### CC pisze output
- Tekst pojawia się w terminalu (streaming)
- Activity: `● writing`
- Matrix rain normalne tempo

### CC wykonuje tool (bash, file edit)
- Activity: `● executing`
- Flash — krótkie rozbłyśnięcie ekranu (opacity bump o 0.1 na 200ms)
- Opcjonalny glitch effect na matrix rain

### Disconnect
- Cały ekran przechodzi w ciemniejszy odcień
- Status bar: czerwony dot + "DISCONNECTED"
- Matrix rain: spowalnia i zanika
- Overlay: "Connecting..." z progress barem (jak w referencji)

---

## Responsywność

| Rozmiar okna | Zachowanie |
|---|---|
| > 1200px | Full layout: terminal + panel obok siebie |
| 800-1200px | Panel zwija się do mini-mode (ikony + wartości, bez progress barów) |
| < 800px | Panel chowa się pod terminal, dostępny przez toggle |

## Animacje

| Animacja | Trigger | Duration | Easing |
|---|---|---|---|
| Metric value change | Nowa wartość z WS | 500ms | ease-out |
| Progress bar fill | Zmiana procentu | 800ms | ease-in-out |
| Panel section appear | Mount | 300ms staggered | ease-out |
| Connection dot pulse | Continuous (connected) | 2s | ease-in-out |
| Matrix rain | Continuous | per-frame | linear |
| Glitch flash | Tool execution | 200ms | step-end |
