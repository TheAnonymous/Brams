# Brams v0.3.1

Brams ist eine dependency-freie Vanilla-CSS/JavaScript-Library für sachliche, robuste Produktoberflächen. Der technische Light-Theme-Stil folgt einer digitalen Rams-Formensprache: Gebrauchswert, Ordnung, Verständlichkeit und Zurückhaltung stehen vor Dekoration.

**Live-Demo:** [Brams-Komponentenkatalog auf GitHub Pages](https://theanonymous.github.io/Brams/)

Die Library ist kein offizielles Braun-Produkt und verwendet keine geschützten Braun-Gestaltungselemente.

## Einbindung

Es gibt keinen Build-Schritt und keine Runtime-Abhängigkeiten. CSS, JavaScript, Sprite und die lokalen Schriftdateien werden gemeinsam ausgeliefert:

```html
<link rel="stylesheet" href="brams.css" />
<script src="brams.js" defer></script>

<button class="brams-button brams-button--primary">Speichern</button>
```

`icons.svg` muss relativ zu `brams.js` beziehungsweise zum Markup unter `icons.svg#…` erreichbar sein. Der Ordner `fonts/` muss relativ zu `brams.css` erhalten bleiben. Es werden keine Schriften, Icons oder anderen Assets von externen Servern geladen.

## Komponentenindex

| Kategorie | Komponenten |
| --- | --- |
| Grundlagen & Aktionen | Card, Divider, Badge, Status, Avatar, Button, Icon Button, Button Group |
| Formulare | Form Field, Text Input, Search Field, Password Field, Textarea, Select, Checkbox, Radio Group, Switch, Segmented Control, Range, Number Stepper, File Upload / Dropzone |
| Navigation | Header, Side Navigation, Breadcrumbs, Tabs, Pagination, Prozess-Stepper |
| Feedback & Overlays | Alert, Toast, Tooltip, Popover, Dropdown Menu, Accordion, Progress Bar, Spinner, Skeleton, Modal Dialog, Drawer, Empty State |
| Daten & Inhalte | Data Table, KPI / Stat, List Group, Description List, Timeline |

Der vollständige Katalog in [index.html](index.html) zeigt alle 44 Komponenten mit realistischen Zuständen und bedienbarem Markup.

## Markup-Konventionen

Brams verwendet durchgehend BEM:

- Block: `.brams-card`
- Element: `.brams-card__header`
- Variante: `.brams-card--selected`
- Zustand: native Attribute wie `disabled`, `readonly`, `aria-invalid="true"`, `aria-selected="true"` oder `data-state="open"`

Alleinstehende Icon Buttons brauchen einen zugänglichen Namen. Dekorative Icons bleiben für Screenreader verborgen:

```html
<button class="brams-icon-button" aria-label="Einstellungen öffnen">
  <svg class="brams-icon" aria-hidden="true">
    <use href="icons.svg#settings"></use>
  </svg>
</button>
```

Interaktionen werden deklarativ gebunden. Styling-Klassen sind nicht gleichzeitig JavaScript-Hooks; dafür stehen `data-brams-*`-Attribute bereit:

```html
<button data-brams-open="#confirm-dialog">Dialog öffnen</button>

<div id="confirm-dialog" class="brams-overlay" hidden tabindex="-1">
  <section class="brams-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <h2 id="dialog-title">Änderungen übernehmen?</h2>
    <button data-brams-close>Schließen</button>
  </section>
</div>
```

## Design Tokens

Die Tokens unter `:root` sind semantisch gruppiert: Farben, Typografie, Größen, Abstände, Fokus, technische Flächen, Signallichter, Schatten, Motion und Z-Index. Produkte können einzelne Werte überschreiben, ohne Komponenten zu kopieren:

```css
:root {
  --brams-color-accent: #11110f;
  --brams-signal-record: #b1261e;
  --brams-hairline: 1px solid var(--brams-color-border);
  --brams-motion-normal: 120ms;
}
```

Brams berücksichtigt `prefers-reduced-motion: reduce`. Der sichtbare Fokus ist über `--brams-focus-color` und `--brams-focus-ring` zentral steuerbar.

## Typografie

Brams bündelt [Archivo](https://github.com/Omnibus-Type/Archivo) lokal als offene, sachliche Grotesk mit historischen Bezügen zu Akzidenz-Grotesk, Helvetica und verwandten Schriften. Verwendet werden die statischen WOFF2-Schnitte Regular (400), Medium (500) und SemiBold (600) aus Commit `b5d63988ce19d044d3e10362de730af00526b672`; `font-display: swap` sorgt für robuste Darstellung ohne externe Font-Requests.

Die Gewichtssystematik bleibt bewusst ruhig: Fließtext und Eingaben nutzen 400, Überschriften, Navigation und Beschriftungen 500, Buttons, aktive Zustände und echte Hervorhebungen höchstens 600. Synthetisches Fett ist deaktiviert. Monospace bleibt Digitalanzeigen, Messwerten, Zeiten, Seriennummern und numerischen Modulindizes vorbehalten; dort werden tabellarische Ziffern verwendet.

Archivo steht unter der SIL Open Font License 1.1. Copyright und vollständiger Lizenztext werden separat unter [`fonts/OFL.txt`](fonts/OFL.txt) mitgeliefert. Die übrige Library bleibt unter der MIT-Lizenz dieses Repositories.

## Formensprache v0.3.1

- Warme Off-White-Flächen, technisches Grau und tiefes Schwarz bilden die Grundpalette. Rot ist Fehlern, Gefahr, Aufnahme und kleinen Betriebssignalen vorbehalten.
- Primäraktionen sind schwarz. Radien bleiben bei 0–2 px; nur funktional runde Elemente wie Statuslampen, Dials, Avatare und Switch-Knöpfe sind kreisförmig.
- Standard-Cards bleiben schattenlos und werden durch Haarlinien, Flächenstufen und das zwölfspaltige Katalograster gegliedert. Nur räumliche Overlays erhalten Schatten.
- Archivo trägt die Oberfläche als lokal eingebundene Grotesk. Monospace ist funktionalen technischen Werten und Anzeigen vorbehalten.
- Success und Warning erscheinen auf neutralen Flächen mit grünen beziehungsweise bernsteinfarbenen Kontrollleuchten und zugänglichem Text.

## JavaScript-API

Interaktive Komponenten werden bei `DOMContentLoaded` automatisch initialisiert. Die globale API ist unter `window.Brams` verfügbar.

### `Brams.init(root = document)`

Initialisiert deklaratives Markup unterhalb von `root`. Wiederholte Aufrufe sind idempotent und registrieren keine doppelten Listener.

```js
const fragment = document.querySelector("#dynamic-content");
Brams.init(fragment);
```

### `Brams.open(target)` und `Brams.close(target)`

Öffnet beziehungsweise schließt Modal Dialog, Drawer, Popover oder Menü. `target` darf ein Element oder ein CSS-Selektor sein.

```js
Brams.open("#settings-drawer");
Brams.close(document.querySelector("#settings-drawer"));
```

Dialog und Drawer bieten Fokusfalle, Escape- und Backdrop-Schließen, Scroll-Lock und Fokuswiederherstellung. Bei gestapelten Overlays reagiert nur die oberste Ebene. Geöffnete und geschlossene Layer senden bubbling Events:

```js
document.addEventListener("brams:open", (event) => console.log(event.target));
document.addEventListener("brams:close", (event) => console.log(event.target));
```

### `Brams.toast(options)`

Erstellt einen zugänglichen Toast, hängt ihn an die Live-Region und gibt das erzeugte Element zurück.

```js
const notice = Brams.toast({
  title: "Gespeichert",
  message: "Control Unit 07 wurde aktualisiert.",
  tone: "success", // neutral | success | warning | danger
  duration: 5000,
});
```

Mit `duration: 0` bleibt ein Toast bis zum manuellen Schließen sichtbar.

## Deklarative Hooks

| Hook | Verhalten |
| --- | --- |
| `data-brams-open`, `data-brams-close` | Overlay öffnen oder schließen |
| `data-brams-popover`, `data-brams-tooltip`, `data-brams-menu` | Verknüpft Auslöser und Floating Layer |
| `data-brams-tabs`, `data-brams-segmented`, `data-brams-accordion` | Tastaturfähige Auswahl und Offenlegung |
| `data-brams-range`, `data-brams-number` | Live-Ausgabe und numerische Schritte |
| `data-brams-file` | Lokale Dateiauswahl und Dropzone; kein Upload |
| `data-brams-pagination`, `data-brams-process`, `data-brams-sortable` | Clientseitige Demo-Zustände |
| `data-brams-password-toggle`, `data-brams-search-clear` | Feldaktionen |
| `data-brams-toast-trigger`, `data-brams-alert-dismiss` | Feedback erzeugen oder entfernen |

Native Form Controls behalten ihre normalen `input`- und `change`-Events. Switch und Segmented Control senden zusätzlich ein bubbling `change`-Event, weil sie als Button-Patterns umgesetzt sind.

## Lokale Vorschau

```bash
python3 -m http.server 8080
```

Danach ist der Katalog unter <http://localhost:8080> erreichbar. Alternativ:

```bash
npm run preview
```

## Tests

Playwright ist die einzige Entwicklungsabhängigkeit; die ausgelieferte Library bleibt dependency-frei.

```bash
npm install
npx playwright install
npm test
```

Die Suite prüft unter Chromium, Firefox und WebKit unter anderem:

- Laden ohne Konsolenfehler oder externe Requests und 44 vorhandene Katalogeinträge
- idempotente Initialisierung, ARIA-Zustände und Tastaturmodelle
- Fokusfalle, Escape, Backdrop, Scroll-Lock und Fokuswiederherstellung
- Toast, Range, Number Stepper, Password, Dateiauswahl, Pagination und Tabellensortierung
- Desktop- und Mobile-Layouts ohne seitenweises horizontales Überlaufen
- Fokusdarstellung, WCAG-AA-Kontrast, Reduced Motion, Disabled-/Invalid-Zustände und visuelle Chromium-Snapshots
- v0.3.1-Tokens, lokale Archivo-Schnitte, schwarze Primäraktionen, reduzierte Radien und schattenlose Standard-Cards
- Desktop- und mobile Gesamtkataloge sowie Detailaufnahmen der code-nativen Kontrolltafel

Chromium-Snapshots werden bewusst aktualisiert mit:

```bash
npm run test:update
```

## Browser

Unterstützt werden aktuelle Versionen von Chromium, Firefox und WebKit. v0.3.1 bewahrt die BEM-Klassen, `data-brams-*`-Hooks und die öffentliche JavaScript-API aus v0.3; das Patch-Release verfeinert ausschließlich Typografie und fontbedingten Reflow.
