# 🌻 Blumenladen Produktliste – Trello Power-Up

Ein maßgeschneidertes, hochoptimiertes Trello Power-Up zur nahtlosen Erfassung, Verwaltung und Auswertung von Bestellungen direkt in Trello-Karten. Entwickelt für den täglichen Blumenladenbetrieb (Firma Renner), eignet sich dieses System perfekt für alle Workflow-basierten Bestell- und Inventarprozesse.

---

## ✨ Features & Highlights

- **Hierarchische Artikelstruktur (Produkte & Materialien):**
  - **Hauptartikel:** Endprodukte (z. B. "Trauerkranz") mit Stückzahl und Verkaufspreis.
  - **Unterartikel:** Materialien/Extras (z. B. "Rose Rot", "Steckschaum") mit Mengen, Aufschlägen, Lieferanten-Zuordnung und Bestellstatus (*Zu bestellen* / *Im Zulauf* / *Vorhanden*).
- **Schnellauswahl-Buttons (Favoriten ★):**
  - Im Katalog lassen sich bis zu 6 Favoriten-Produkte markieren, die direkt als Buttons im Hauptartikel-Popup auf der Karte erscheinen. 1 Klick füllt Name und Preis aus, der Cursor springt sofort ins Mengenfeld!
- **Tastatur-Optimierter Flow & Erfassungskette:**
  - Tastatur-Shortcuts (`+` für neues Produkt, `n` für neues Material am aktiven Hauptartikel).
  - Nach dem Speichern eines Materials springt der Fokus automatisch auf den `+ Unterartikel hinzufügen [ n ]` Button zurück. So lassen sich 5 Materialien ohne Maus in Sekunden erfassen: `n` ➔ *Name tippen* ➔ `Enter` ➔ `n` ➔ *Name tippen* ➔ `Enter`.
  - Im Katalog-Manager fokussiert `+ Hinzufügen` sofort das Namensfeld, `Enter` speichert die Inline-Zeile direkt ab.
- **Smart Status Auto-Switch:**
  - Sobald beim Tippen eines Materialnamens ein Lieferant aus dem Katalog vorausgefüllt wird, schaltet der Status automatisch von *"Vorhanden"* auf *"Zu bestellen"* um.
- **Automatische Trello-Label-Synchronisation:**
  - Setzt automatisch Lieferanten-Labels und das Sonder-Label *"Alles bestellt"* auf Karten, sobald offene Unterartikel existieren bzw. alle Materialien im Zulauf sind.
- **Auswertung & Bestell-Manager:**
  - Board-weites Dashboard mit Filterung nach Trello-Liste, Datum, Status, Lieferant und Volltextsuche.
  - Sammelaktionen (Bulk-Statusupdates) für mehrere Karten gleichzeitig mit Concurrency-Pool (Rate-Limit-Schutz).
  - Live-Badge mit der Anzahl noch offener Bestellungen direkt am Tab.
- **Export & Druck:**
  - CSV-Export (mit Schutz vor Excel-Formel-Injektionen).
  - Text-Export für E-Mail-Lieferantenbestellungen.
  - Druck-Ansicht / PDF-Export.
- **Sicherheit & Präzision:**
  - XSS-Schutz für Texte und HTML-Attribute (`escapeHtmlAttr`), Event-Delegation statt inline Handlern, atomares Trello-REST-API Label-Updating.
  - Cent-genaue Berechnungen (Ganzzahlen) zur Vermeidung von Fließkomma-Rundungsfehlern.
- **Native Trello Dark Mode Unterstützung.**

---

## 📁 Dateistruktur

Der gesamte Quellcode des Power-Ups befindet sich im Ordner `PowerUp/`:

```
PowerUp/
├── index.html            Connector-Iframe (lädt client.js)
├── client.js              Registrierung aller Capabilities (Card Badges, Buttons, Popups)
├── manifest.json           Trello Power-Up Manifest & Rechte
├── config.js               Secrets (App-Key, Power-Up-ID, Base-URL) – NICHT in Git!
├── config.example.js       Vorlage für config.js
│
├── utils.js                Zentrale Utility-Bibliothek (Shared Helpers, REST API, Label-Sync)
│
├── table.html / table.js   Kartenrückseite: Produkt- & Materialerfassung
├── katalog.html / katalog.js  Katalog-Verwaltung (Zwei-Tab-Ansicht mit Inline-Edit)
├── board.html / board.js   Auswertung & Bestell-Manager Dashboard
├── settings.html / settings.js  Lieferanten- & Label-Konfiguration
├── menu.html / menu.js     Einstiegs-Popup
├── auth.html / auth.js     Trello OAuth-Autorisierungs-Popup
│
├── technical_documentation.md  Ausführliche technische Architektur- & Code-Dokumentation
├── technical_documentation.pdf Generiertes PDF der technischen Dokumentation
├── hell.css / dunkel.css   Styling für Light & Dark Mode
└── icon.svg / icon-gray.svg Power-Up Icons
```

---

## 🚀 Hosting & Setup

Alle Dateien aus dem `PowerUp/`-Ordner müssen per **HTTPS** erreichbar sein (Trello lädt Power-Ups per Iframe).

### 1. Konfiguration (`config.js`)
1. Kopiere im Ordner `PowerUp/` die Datei `config.example.js` und benenne die Kopie in `config.js` um.
2. Trage deine Zugangsdaten ein:
   ```javascript
   const CONFIG = {
     TRELLO_APP_KEY: 'DeinTrelloAppKey',
     POWERUP_ID: 'DeinePowerUpID',
     BASE_URL: 'https://deine-domain.de/'
   };
   ```
*(Hinweis: `config.js` ist in `.gitignore` eingetragen und wird nicht hochgeladen.)*

### 2. URLs anpassen
In `manifest.json`, `index.html` und `board.html` gegebenenfalls die absoluten Basis-URLs auf deine Server-Domain anpassen. Intern nutzt der Code relative Pfade (`./`).

---

## ⚙️ Power-Up in Trello registrieren

1. Öffne das [Trello Power-Up Admin Portal](https://trello.com/power-ups/admin).
2. Erstelle ein neues benutzerdefiniertes Power-Up:
   - **Name:** Blumenladen Produktliste
   - **Iframe-Connector-URL:** `https://deine-domain.de/index.html`
3. Aktiviere das Power-Up in deinem Trello-Board über **Menü ➔ Power-Ups**.

---

## 📖 Nutzung im Alltag

### Auf der Karte (Kartenrückseite):
1. Karte öffnen ➔ Bereich **Bestellte Artikel**.
2. **Neues Produkt:** `+` drücken oder `+ Artikel hinzufügen` klicken.
   - *Tipp:* Klicke auf einen der 6 Favoriten-Buttons oben im Popup, gib die Stückzahl ein und drücke `Enter`.
3. **Unterartikel / Materialien:** `n` drücken oder `+ Unterartikel hinzufügen` klicken.
   - Materialtippen ➔ Autocomplete wählt Preis & Lieferant ➔ Status springt automatisch auf *"Zu bestellen"* ➔ `Enter` drücken.
   - Für das nächste Material sofort wieder `n` drücken!

### Auf dem Board (Auswertung & Bestell-Manager):
1. Oben im Board auf den Button **"Auswertung & Bestell-Manager"** klicken.
2. Im Tab **Auswertung** Gesamtmengen und Umsätze filtern, als CSV exportieren oder ausdrucken.
3. Im Tab **Bestell-Manager** alle offenen Lieferantenbestellungen einsehen, per Klick den Status hochstufen (*Zulauf* / *Vorhanden*) oder als E-Mail-Text kopieren.

---

## 📚 Technische Dokumentation

Ausführliche Details zur Architektur, Datenstruktur, Sicherheitskonzepten (XSS/CSV-Injection), API-Integration und Modulreferenz findest du in:
- 📖 [technical_documentation.md](PowerUp/technical_documentation.md)
- 📄 [technical_documentation.pdf](PowerUp/technical_documentation.pdf)

---

## 📜 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert. Weitere Details findest du in der [LICENSE](LICENSE) Datei.
