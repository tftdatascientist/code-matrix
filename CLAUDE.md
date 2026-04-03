# 🟢 MATRIX GUI — Claude Code Terminal Visualizer

> **Rola tego pliku:** CLAUDE.md to **router / drogowskaz**. Nie zawiera planów — tylko kieruje do właściwych dokumentów na każdym etapie pracy.

---

## 📁 Mapa dokumentacji

| Dokument | Zawartość | Kiedy sięgać |
|---|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architektura systemu, diagramy przepływu danych, warstwy aplikacji | Na starcie każdego modułu — żeby wiedzieć jak elementy łączą się ze sobą |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | Wybór technologii, zależności, uzasadnienie decyzji | Przy setup projektu i instalacji deps |
| [`docs/UI_DESIGN.md`](docs/UI_DESIGN.md) | Specyfikacja wizualna: layout, kolorystyka, efekty Matrix, typografia, komponenty | Przy budowaniu każdego komponentu UI |
| [`docs/PROTOCOL.md`](docs/PROTOCOL.md) | Protokół komunikacji terminal → GUI, format wiadomości WebSocket, parsing sesji CC | Przy implementacji warstwy transportowej i parsera |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Plan fazowy, kolejność zadań, definicja "done" na każdym etapie | **ZAWSZE na początku sesji** — żeby wiedzieć co robić dalej |
| [`docs/FUTURE_CONTROL.md`](docs/FUTURE_CONTROL.md) | Przygotowanie furtki do sterowania CC z GUI, architektura input pipeline | Przy fazie 4+ gdy podstawowy read-only działa |

---

## 🔄 Workflow dla Claude Code

```
1. Otwórz IMPLEMENTATION_PLAN.md → znajdź aktualną fazę
2. Przeczytaj odpowiedni dokument(y) z tabeli powyżej
3. Implementuj zgodnie z planem
4. Oznacz zadanie jako ✅ w IMPLEMENTATION_PLAN.md
5. Wróć do punktu 1
```

---

## 🧭 Quick Nav — co robić w danej sytuacji

| Sytuacja | Idź do |
|---|---|
| "Zaczynam projekt od zera" | `IMPLEMENTATION_PLAN.md` → Faza 0 |
| "Buduję komponent UI" | `UI_DESIGN.md` + `TECH_STACK.md` |
| "Łączę terminal z GUI" | `PROTOCOL.md` + `ARCHITECTURE.md` |
| "Coś nie streamuje się" | `PROTOCOL.md` → sekcja troubleshooting |
| "Chcę dodać kontrolkę input" | `FUTURE_CONTROL.md` |
| "Nie wiem jaki model danych" | `ARCHITECTURE.md` → sekcja data flow |

---

## ⚠️ Zasady projektu

- **Read-only first** — GUI na start jest oknem obserwacyjnym, kontrola zostaje w VS Code
- **Furtka otwarta** — architektura musi pozwalać na dodanie input pipeline bez refaktoru
- **1:1 fidelity** — GUI pokazuje DOKŁADNIE to co terminal, bez filtrowania
- **Matrix aesthetic** — to nie skin, to fundament UX. Każdy element musi oddawać klimat
- **Modularność** — każdy komponent jest wymienny i testowalny osobno
