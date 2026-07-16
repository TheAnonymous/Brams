# Changelog

Alle relevanten Änderungen an Brams werden in dieser Datei dokumentiert. Das Projekt folgt ab v1.0.0 der semantischen Versionierung.

## 1.1.0 — 2026-07-16

### Formensprache

- Katalog-Hero, Systemübersicht und Service-Studie sind vollständig aus semantischem HTML und CSS konstruiert; acht dekorative WebP-Leitmotive entfallen.
- Ein code-natives Kontrollinstrument, ein durchgehendes zwölfspaltiges Ordnungsraster und quadratische Geometrie tragen die digitale Rams-Formensprache jetzt über alle Katalogebenen.
- Die sieben Katalogbereiche teilen sich eine kompakte, sticky Referenzleiste; Desktop, Tablet, 390-px-Mobile und 320-px-Minimum besitzen geprüfte eigenständige Kompositionen.

### Qualität und Kompatibilität

- Alle 44 Komponenten, BEM-Klassen, deklarativen `data-brams-*`-Hooks und Methoden der globalen JavaScript-API bleiben kompatibel.
- Aktualisierte Chromium-Snapshots decken Gesamtkatalog, Kontrollinstrument, Systemübersicht, Komponentenfinder, Codepanels, Overlays und Service-Studie ab.
- Der Katalog lädt weiterhin ausschließlich lokale Schriften und den lokalen SVG-Sprite, nun ohne dekorative Rasterbilder oder externe Requests.

## 1.0.0 — 2026-07-16

### Stabil

- 44 dependency-freie Light-Theme-Komponenten mit BEM-Klassen, deklarativen `data-brams-*`-Hooks und der globalen API `Brams.init/open/close/toast`.
- Lokale Archivo-Schriften, lokaler SVG-Sprite und vollständig lokale Showcase-Assets ohne externe Runtime-Requests.
- Tastaturmodelle, Fokusmanagement, Reduced Motion, Responsive-Layouts ab 320 px und Chromium-Snapshots.
- Kompatibilitätsalias `.brams-pagination__bramstton` für den früher veröffentlichten Tippfehler.

### Gegenüber v0.5.0 verbessert

- Dialoge und Drawer isolieren den Hintergrund mit `inert`, einschließlich korrekt gestapelter Overlays und weiterhin erreichbarer Live-Regionen.
- Finder-Gruppen, List Group, Skeleton, Drawer und Toast-Region verwenden gültige Screenreader-Semantik.
- Automatisierte Axe-Prüfungen decken Katalog, Finder, Modal, Drawer, Popover und Menü gegen WCAG A/AA sowie relevante Best Practices ab.
- GitHub Actions prüft jeden Pull Request und jeden Push auf `main` reproduzierbar mit Node 24.18.0 sowie Chromium, Firefox und WebKit.

### Kompatibilität

- Die in v0.3 bis v0.5 veröffentlichten BEM-Klassen, `data-brams-*`-Hooks und JavaScript-Methoden bleiben erhalten.
- Showcase-spezifische `data-brams-demo-*`-Hooks und `catalog.js` sind weiterhin kein Teil der Library-API.
