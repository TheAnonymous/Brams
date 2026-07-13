# Brams

Ein kleines, dependency-freies Web-UI-System, inspiriert von der Klarheit und
Funktionalität klassischer Braun-Industriegestaltung. Es ist kein offizielles
Braun-Produkt und verwendet keine geschützten Braun-Gestaltungselemente.

## Start

Die Demo benötigt keinen Build-Schritt. Öffne `index.html` direkt im Browser
oder starte im Projektordner einen lokalen Server:

```bash
python3 -m http.server 8080
```

Danach ist die Showcase-Seite unter `http://localhost:8080` erreichbar.

## Inhalt

- `brams.css` – Design Tokens, Reset und die Komponentenbibliothek
- `brams.js` – kleine, zugängliche Interaktionen für Tabs, Switches,
  Segmented Controls und den Volume-Regler
- `index.html` – lebendige Referenzseite für die Komponenten

## Verwendung

```html
<link rel="stylesheet" href="brams.css" />
<script src="brams.js" defer></script>

<button class="brams-button brams-button--primary">Speichern</button>
```

Die zentralen Werte liegen als CSS-Variablen in `:root`. Ein Produkt kann sie
gezielt überschreiben, ohne die Komponenten selbst kopieren zu müssen.

```css
:root {
  --brams-accent: #cf3b2f;
  --brams-radius: 0.25rem;
}
```
