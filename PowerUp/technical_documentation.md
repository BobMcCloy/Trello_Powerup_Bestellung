# Technical Documentation: Trello Power-Up "Blumenladen Produktliste"

## 1. System Overview

Das "Blumenladen Produktliste" Trello Power-Up ist eine clientseitige Web-Applikation, die als iframe innerhalb der Trello-UI (Atlassian Design System) gerendert wird. Das Power-Up ermöglicht es Nutzern, hierarchische Produktlisten (Hauptartikel und Unterartikel) auf Trello-Karten zu verwalten. Es bietet des Weiteren einen globalen Bestell-Manager mit Bulk-Update, Katalogverwaltung, Lieferanten-Konfiguration und automatische Trello-Label-Synchronisation (inklusive "Alles bestellt" Label-Logik).

### 1.1 Architecture & Tech Stack

- **Architektur:** Iframe-basierte Micro-Frontend-Architektur. Das Power-Up läuft vollständig im Browser des Nutzers.
- **Frontend-Technologien:** Vanilla JavaScript (ES5/ES6), HTML5, CSS3. Keine schweren Frameworks (wie React/Vue) zur Wahrung der Performance.
- **Trello API:**
  - `TrelloPowerUp.initialize()` für Capability-Registrierung (`client.js`).
  - `TrelloPowerUp.iframe()` für die Kontext-Kommunikation innerhalb der iframes.
  - **Trello PluginData:** Zur Persistenz von Datenstrukturen (via `t.get()` und `t.set()`).
  - **Trello REST API:** (via `fetch`) zum Setzen von Labels über die atomare `PUT /1/cards/{id}` Route zur Vermeidung von Concurrency-Konflikten.

## 2. Capability Endpoints (Manifest & Client)

Die Trello-Capabilities sind in der `manifest.json` deklariert und in der `client.js` implementiert:

| Capability | Funktion | Referenzdatei | Beschreibung |
| :--- | :--- | :--- | :--- |
| `card-buttons` | "Produkte / Bestellung" | `table.html` | Öffnet das Modal auf einer bestimmten Karte, um Artikel (Haupt/Unter) hinzuzufügen. Bietet Tastatur-Shortcuts. |
| `board-buttons` | "Bestell-Manager" | `board.html` | Board-weites Dashboard mit Filter-, Auswertungs-, CSV-Export-Funktionen und Bulk-Status-Updates. |
| `board-buttons` | "Katalog Manager" | `katalog.html` | Verwaltung der standardisierten Artikelvorlagen (Preise, Lieferanten) im Tabellen-Layout. |
| `show-settings` | "Einstellungen" | `settings.html` | Verwaltung der dynamischen Lieferanten-Liste und Trello-Label-Mappings inkl. Spezial-Labels. |
| `authorization-status` | Auth-Check | `auth.html` | Prüft bzw. fordert Schreibzugriff auf das Trello-Konto an (für Label-Sync). |

## 3. Data Storage & Schema (Trello PluginData)

Das Power-Up nutzt Trellos `shared` Scope zur Speicherung. Die Speicherung erfolgt asynchron auf den Servern von Atlassian/Trello.

### 3.1 produkte (Scope: card, Visibility: shared)
Speichert die auf der Karte angelegten Artikel.

```json
[
  {
    "id": "180a5...",
    "stk": "2",
    "produkt": "Steckschaum",
    "preis": "10.50",
    "lieferant": "lief1",
    "unterartikel": [
      {
        "id": "180a6...",
        "stk": "1",
        "produkt": "Grün",
        "preis": "5.00",
        "lieferant": "lief2",
        "status": "bestellen" // Enum: "bestellen", "zulauf", "vorhanden"
      }
    ]
  }
]
```

### 3.2 lieferanten (Scope: board, Visibility: shared)
Speichert die dynamische Liste der konfigurierten Lieferanten für das Board.

```json
[
  {
    "id": "lief1",
    "name": "Volmary",
    "labelId": "5e1f7a..." // Verknüpfte Trello-Label-ID
  }
]
```

### 3.3 statusLabels (Scope: board, Visibility: shared)
Speichert Spezial-Labels, die abhängig vom Bestellstatus gesetzt werden.
```json
{
  "allesBestellt": "5f3a2b..."
}
```

### 3.4 katalog (Scope: board, Visibility: shared)
Speichert die standardisierten Artikelvorlagen.

```json
[
  {
    "name": "Blumendraht",
    "preis": "2.99",
    "lieferant": "lief1"
  }
]
```

## 4. Core Modules & Business Logic

### 4.1 table.js (Karten-Ansicht)
- **Verantwortlichkeit:** Rendern der Tabelle innerhalb einer Karte. CRUD-Operationen für Haupt- und Unterartikel.
- **Tastatur-Steuerung:** Bietet Hotkeys (`+` für Hauptartikel, `n` für fokussierten Unterartikel, `ESC` zum Schließen), um schnelles Erfassen ohne Maus zu ermöglichen.
- **Auto-Fokus Logik:** Setzt Fokus automatisch auf Stückzahl-Eingabefelder, selektiert Texte automatisch (`stkInput.select()`) und schaltet den Status initial basierend auf der Lieferantenauswahl intelligent um.
- **Trigger:** Löst nach Statusänderungen die `syncCardLabels()` Methode aus.

### 4.2 board.js (Bestell-Manager & Auswertung)
- **Verantwortlichkeit:** Board-weite Aggregation aller Karten via `t.cards('all')`. Gruppiert Artikel semantisch nach Lieferanten.
- **Bulk Update:** Ermöglicht es, ganze Gruppen von Artikeln mit einem Klick auf einen neuen Status ("Zulauf", "Vorhanden") hochzustufen.
- **Race-Condition-Schutz:** Verhindert redundante API-Requests durch schnelles Klicken mithilfe eines Set (`inFlightRequests`) und deaktivierten (disabled) Buttons.
- **Sicherheit (CSV-Export):** Nutzt `csvFeld()` für Quotation und das Voranstellen eines `'` bei Formelzeichen (`=`, `+`, `-`, `@`), um Excel-Injections zu verhindern.

### 4.3 katalog.js (Katalogverwaltung)
- **Verantwortlichkeit:** Hinzufügen, Bearbeiten und Löschen von Katalogeinträgen in einem standardisierten HTML-Tabellen-Layout.
- **Duplikat-Erkennung:** Strikter Abgleich per `trim().toLowerCase()`, um Duplikate zu verhindern.

### 4.4 settings.js (Dynamische Lieferanten)
- **Verantwortlichkeit:** Verwaltung der Lieferanten als dynamisches Array sowie das Mapping von Spezial-Labels (z. B. "Alles bestellt"-Label).

### 4.5 utils.js (Zentrale Helfer & API)
Beinhaltet systemweite Utilities, wie z.B. XSS-Schutz (`escapeHtml`), Währungsformatierung (`formatEuro`) und globale Fehlerbehandlung (`window.handleError`).

**Trello Label-Sync (`syncCardLabels`):**
- Holt Lieferanten und `statusLabels` selbstständig.
- **Status-Logik:** Lieferanten-Labels werden nur dann aktiv, wenn explizite Unterartikel auf `bestellen` oder `zulauf` stehen. Das "Alles bestellt"-Label greift, wenn keine Artikel auf `bestellen` und mindestens einer auf `zulauf` steht.
- **Atomares Label-Update:** Nutzt die Trello REST API (`GET /1/cards/{id}?fields=idLabels`) zur Evaluation der aktiven Labels, kalkuliert das Delta und schickt einen synchronen, atomaren `PUT`-Befehl mit der korrigierten `idLabels`-Liste an Trello. Dies eliminiert API-Concurrency-Fehler (HTTP 409 Conflict).

## 5. UI / Styling (Atlassian Design System)

Die CSS-Dateien (`hell.css` und `dunkel.css`) orientieren sich strikt am Atlassian Design System (ADS).
- **Farben:** Nutzt `--trello-blue (#0C66E4)`, `--bg-subtle`, `--bg-hover`.
- **Typografie & Formen:** Anpassung der Schriftgrößen und Button-Gestaltung für eine nahtlose Integration in das moderne Trello UI. Textbasierte Buttons haben priorisiert Icons ersetzt.
- **Cache-Busting:** Alle CSS-Dateien werden in den HTML-Headern mit dem Parameter `?v=...` eingebunden, um aggressive Browser-Caches zu umgehen.

## 6. Security Considerations

- **Cross-Site Scripting (XSS):** User-Input wird vor der DOM-Injektion (`.innerHTML`) konsequent mit der Funktion `escapeHtml` bereinigt.
- **CSV Injection:** Vorbeugung durch explizite Typprüfung und Sanitizing in `board.js`.
- **Authentication:** REST API-Calls erfolgen ausschließlich nach explizitem Trello-User-Consent (`t.getRestApi().isAuthorized()`). Der Access Token wird nie persistiert, sondern per API On-Demand abgerufen.
