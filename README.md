# 🌻 Blumenladen Produktliste - Trello Power-Up

Ein maßgeschneidertes, Open-Source Trello Power-Up zur nahtlosen Erfassung, Verwaltung und Auswertung von Bestellungen direkt in Trello-Karten. Ursprünglich entwickelt für den automatisierten Blumenkübel-Container, eignet sich dieses System perfekt für alle Workflow-basierten Bestell- und Inventarprozesse.

## ✨ Features

* **Haupt- und Unterartikel:** Erfassung von Artikeln mit Stückzahl und Preis. Unterartikel können an Hauptartikel angehängt und mit einem Bestellstatus ("Muss bestellt werden" / "Vorhanden") versehen werden.
* **Zentraler Katalog:** Eine integrierte, board-weite Vorschlagsliste, die bei der Eingabe unterstützt und direkt über Trello verwaltet wird.
* **Sauberes UI:** Dateneingabe über aufgeräumte Overlays (Popups) innerhalb der Karte, um den Platz optimal zu nutzen.
* **Native Trello-Integration:** Daten werden über die `pluginData`-API direkt im Trello-Speicher gesichert. Es wird **keine** externe Datenbank benötigt.
* **Umfangreiche Auswertung:** Ein Klick auf den Board-Button öffnet ein Dashboard zur Filterung aller Bestellungen nach Trello-Liste, Fälligkeitsdatum, Status und freier Textsuche.
* **Export & Druck:** Ergebnisse der Auswertung können als CSV exportiert oder im Kiosk-Modus direkt als PDF gedruckt werden.
* **Dark Mode:** Vollständige und automatische Unterstützung des nativen Trello Dark Modes.

## 📁 Dateistruktur

* `manifest.json` - Trello Konfiguration und Rechte
* `index.html` - Einstiegspunkt für den Iframe-Connector
* `board.html` - Board-Ansicht: Auswertung, Filter und Bestell-Manager
* `table.html` - Kartenrückseite: Anzeige und Eingabe der Bestellungen
* `menu.html` / `katalog.html` - Verwaltungs-UIs
* `hell.css` / `dunkel.css` - Styling für Light & Dark Mode
* `icon.svg` / `icon-gray.svg` - Power-Up Icons

## 🚀 Hosting & Setup

Alle Dateien dieses Repositories müssen per HTTPS erreichbar sein (Trello lädt Power-Ups per Iframe). Lade die Dateien auf deinen Webspace (z. B. lima-city) oder nutze einen Webserver.

### URLs anpassen
In den Dateien `manifest.json`, `index.html` und `board.html` müssen die absoluten URLs (`https://renner-trello.de.cool/...`) durch deine tatsächliche Domain ersetzt werden. Intern verwendet der Code bereits sichere, relative Pfade (`./`).

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
