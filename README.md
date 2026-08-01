# 🌻 Blumenladen Produktliste - Trello Power-Up

Ein maßgeschneidertes, Open-Source Trello Power-Up zur nahtlosen Erfassung, Verwaltung und Auswertung von Bestellungen direkt in Trello-Karten. Ursprünglich entwickelt für den automatisierten Blumenkübel-Container, eignet sich dieses System perfekt für alle Workflow-basierten Bestell- und Inventarprozesse.

## ✨ Features

* **Haupt- und Unterartikel:** Erfassung von Artikeln mit Stückzahl und Preis. Unterartikel können an Hauptartikel angehängt und mit einem Bestellstatus ("Zu bestellen" / "Im Zulauf" / "Vorhanden") versehen werden.
* **Zentraler Katalog:** Eine integrierte, board-weite Vorschlagsliste, die bei der Eingabe unterstützt und direkt über Trello verwaltet wird.
* **Sauberes UI & Architektur:** Dateneingabe über aufgeräumte Overlays (Popups) innerhalb der Karte. Die Codebasis ist modular in separierte `.html` und `.js` Dateien aufgeteilt.
* **Native Trello-Integration:** Daten werden über die `pluginData`-API direkt im Trello-Speicher gesichert. Es wird **keine** externe Datenbank benötigt.
* **Umfangreiche Auswertung:** Ein Klick auf den Board-Button öffnet ein Dashboard zur Filterung aller Bestellungen nach Trello-Liste, Fälligkeitsdatum, Status und freier Textsuche.
* **Bestell-Manager:** Eigenes Tab für den schnellen Überblick über alle noch offenen Bestellungen, inklusive Direkt-Buttons zum Ändern des Status.
* **Export & Druck:** Ergebnisse der Auswertung können als CSV exportiert oder im Kiosk-Modus direkt als PDF gedruckt werden.
* **Dark Mode:** Vollständige und automatische Unterstützung des nativen Trello Dark Modes.

## 📁 Dateistruktur

Der gesamte ausführbare Code des Power-Ups befindet sich im Ordner `PowerUp/`:

* `manifest.json` - Trello Konfiguration und Rechte
* `index.html` & `client.js` - Einstiegspunkt für den Iframe-Connector
* `config.example.js` - Vorlage für die Trello-API Zugangsdaten
* `board.html` / `board.js` - Dashboard: Auswertung, Filter und Bestell-Manager
* `table.html` / `table.js` - Kartenrückseite: Anzeige und Eingabe
* `menu.html` / `katalog.html` - Verwaltungs-UIs mit zugehörigen `.js` Skripten
* `hell.css` / `dunkel.css` - Styling für Light & Dark Mode
* `icon.svg` / `icon-gray.svg` - Power-Up Icons

## 🚀 Hosting & Setup

Alle Dateien aus dem `PowerUp/`-Ordner müssen per HTTPS erreichbar sein (Trello lädt Power-Ups per Iframe). Lade die Dateien auf deinen Webspace (z. B. lima-city) oder nutze einen Webserver.

### 1. Konfiguration (WICHTIG)
Damit das Power-Up Daten über die Trello-Rest-API auslesen kann, benötigt es Zugangsdaten:
1. Kopiere im Ordner `PowerUp/` die Datei `config.example.js` und benenne die Kopie in `config.js` um.
2. Trage in der neuen `config.js` deinen Trello App-Key (`TRELLO_APP_KEY`) sowie deine Power-Up ID (`POWERUP_ID`) ein.
*(Hinweis: Die `config.js` wird durch die `.gitignore` automatisch vor dem Upload zu GitHub geschützt, damit deine Schlüssel privat bleiben.)*

### 2. URLs anpassen
In den Dateien `manifest.json`, `index.html` und `board.html` müssen die fest hinterlegten absoluten URLs (z.B. `https://renner-trello.de.cool/...`) durch deine tatsächliche Server-Domain ersetzt werden. Intern verwendet der Code sichere, relative Pfade (`./`).

## ⚙️ Power-Up in Trello registrieren

1. Trello-Board öffnen -> **Menü** -> **Power-Ups** -> **Benutzerdefiniert erstellen**.
2. Formular ausfüllen:
   * **Name:** Blumenladen Produktliste
   * **Iframe-Connector-URL:** `https://deine-domain.de/index.html`
3. Speichern und auf dem Board unter "Power-Ups" aktivieren.

## 📖 Nutzung im Alltag

**Auf der Karte (Bestellungen erfassen):**
1. Öffne eine Karte. Auf der Rückseite erscheint der Bereich "Bestellte Artikel".
2. Klicke auf "+ Artikel hinzufügen".
3. Beginne zu tippen – der Katalog schlägt dir passende Artikel vor.
4. Unterartikel lassen sich pro Hauptartikel hinzufügen und mit einem Status versehen.

**Auf dem Board (Auswerten & Manager):**
1. Klicke oben im Board auf den Button "Auswertung & Bestell-Manager".
2. Nutze die Tabs, um zwischen der Statistik und den aktiven Bestellungen zu wechseln.
3. Ändere den Status von Artikeln direkt über die Buttons im Bestell-Manager (Daten werden sofort auf der Karte aktualisiert).
4. Exportiere die aktuelle Ansicht als CSV oder drucke sie aus.

## 📜 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert. Weitere Details findest du in der [LICENSE](LICENSE) Datei.
