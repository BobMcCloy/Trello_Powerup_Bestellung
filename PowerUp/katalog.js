/* global TrelloPowerUp, CONFIG */
var t = TrelloPowerUp.iframe({
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});
var katalog = [];
var lieferantenEinstellungen = null;
var editIndex = null;

// Bisherige unterartikel.csv-Einträge als Startwert, falls im Board
// noch nichts gespeichert ist. (Nun in utils.js definiert)

function getLieferantName(liefKey) {
  if (!liefKey) return 'Kein Lieferant';
  var found = lieferantenEinstellungen.find(l => l.id === liefKey);
  if (found) return found.name;
  return liefKey;
}

function speichernUndNeuZeichnen() {
  return t.set('board', 'shared', 'katalog', katalog)
    .then(zeichnen)
    .catch(handleError);
}

function zeichnen() {
  var el = document.getElementById('liste');

  if (!katalog.length) {
    el.innerHTML = '<tr><td colspan="4" class="empty-state">Noch keine Einträge.</td></tr>';
    t.sizeTo(document.body);
    return;
  }

  el.innerHTML = katalog.map(function (eintrag, i) {
    var eName = typeof eintrag === 'string' ? eintrag : eintrag.name;
    var ePreis = (typeof eintrag === 'object' && eintrag.preis) ? formatEuro(eintrag.preis) : '';
    var eLief = (typeof eintrag === 'object' && eintrag.lieferant) ? getLieferantName(eintrag.lieferant) : '';

    return `<tr>
      <td><strong>${escapeHtml(eName)}</strong></td>
      <td>${escapeHtml(eLief)}</td>
      <td class="zahl">${escapeHtml(ePreis)}</td>
      <td class="katalog-actions">
        <span class="bearbeiten" data-i="${i}" title="Bearbeiten">Bearbeiten</span>
        <span class="loeschen" data-i="${i}" title="Löschen">Löschen</span>
      </td>
    </tr>`;
  }).join('');

  el.querySelectorAll('.loeschen').forEach(function (btn) {
    btn.addEventListener('click', function () {
      katalog.splice(parseInt(btn.getAttribute('data-i'), 10), 1);
      speichernUndNeuZeichnen();
    });
  });

  el.querySelectorAll('.bearbeiten').forEach(function (btn) {
    btn.addEventListener('click', function () {
      editIndex = parseInt(btn.getAttribute('data-i'), 10);
      var item = katalog[editIndex];
      var name = typeof item === 'string' ? item : item.name;
      var preis = (typeof item === 'object' && item.preis) ? item.preis : '';
      var lief = (typeof item === 'object' && item.lieferant) ? item.lieferant : '';

      document.getElementById('neuer-eintrag').value = name;
      document.getElementById('neuer-preis').value = preis;
      document.getElementById('neuer-lieferant').value = lief;

      var btnAdd = document.getElementById('hinzufuegen');
      btnAdd.textContent = 'Speichern';
      btnAdd.style.backgroundColor = 'var(--trello-blue)';
      btnAdd.style.color = 'white';

      document.getElementById('neuer-eintrag').focus();
    });
  });

  t.sizeTo(document.body);
}

function showError(element) {
  element.classList.remove('error-blink');
  void element.offsetWidth; // reflow
  element.classList.add('error-blink');
  element.focus();
}

function hinzufuegen() {
  var feld = document.getElementById('neuer-eintrag');
  var preisFeld = document.getElementById('neuer-preis');
  var liefFeld = document.getElementById('neuer-lieferant');
  var btnAdd = document.getElementById('hinzufuegen');

  var wert = feld.value.trim();
  var preis = preisFeld.value.trim();
  var lief = liefFeld.value;

  if (!wert) {
    showError(feld);
    return;
  }

  if (preis !== '') {
    preis = preis.replace(',', '.');
    var pVal = parseFloat(preis);
    if (isNaN(pVal) || pVal < 0) {
      showError(preisFeld);
      return;
    }
  }

  // Check if name already exists (and is not the one we are editing)
  var exists = katalog.findIndex(function (k) {
    var kName = typeof k === 'string' ? k : k.name;
    return kName.trim().toLowerCase() === wert.toLowerCase();
  });

  if (exists !== -1 && exists !== editIndex) {
    alert('Dieser Artikel existiert bereits im Katalog.');
    feld.focus();
    return;
  }

  if (editIndex !== null) {
    katalog[editIndex] = { name: wert, preis: preis, lieferant: lief };
    editIndex = null;
    btnAdd.textContent = 'Hinzufügen';
    btnAdd.style.backgroundColor = '';
    btnAdd.style.color = '';
  } else {
    katalog.push({ name: wert, preis: preis, lieferant: lief });
  }

  katalog.sort(function (a, b) {
    var nameA = typeof a === 'string' ? a : a.name;
    var nameB = typeof b === 'string' ? b : b.name;
    return nameA.localeCompare(nameB, 'de');
  });

  feld.value = '';
  preisFeld.value = '';
  liefFeld.value = '';
  feld.focus();
  speichernUndNeuZeichnen();
}

document.getElementById('hinzufuegen').addEventListener('click', hinzufuegen);
['neuer-eintrag', 'neuer-preis', 'neuer-lieferant'].forEach(function (id) {
  document.getElementById(id).addEventListener('keydown', function (e) {
    if (e.key === 'Enter') hinzufuegen();
  });
});

t.render(function () {
  Promise.all([
    t.get('board', 'shared', 'katalog', STANDARD_KATALOG),
    t.get('board', 'shared', 'lieferanten')
  ]).then(function (res) {
    var gespeichert = res[0];
    var rawLief = res[1];

    lieferantenEinstellungen = [];
    if (rawLief && typeof rawLief === 'object' && !Array.isArray(rawLief)) {
      if (rawLief.lief1 && rawLief.lief1.name) lieferantenEinstellungen.push({ id: 'lief1', name: rawLief.lief1.name });
      if (rawLief.lief2 && rawLief.lief2.name) lieferantenEinstellungen.push({ id: 'lief2', name: rawLief.lief2.name });
    } else if (Array.isArray(rawLief)) {
      lieferantenEinstellungen = rawLief;
    }

    // Populate Lieferanten Dropdown
    var select = document.getElementById('neuer-lieferant');
    var html = '<option value="">- Kein Lieferant -</option>';
    lieferantenEinstellungen.forEach(function (lief) {
      if (lief.name) {
        html += '<option value="' + escapeHtml(lief.id) + '">' + escapeHtml(lief.name) + '</option>';
      }
    });
    select.innerHTML = html;

    // Migrate string array to object array if needed
    katalog = gespeichert.map(function (item) {
      if (typeof item === 'string') {
        return { name: item, preis: '', lieferant: '' };
      }
      return item;
    });

    var context = t.getContext();
    if (context && context.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    zeichnen();
  });
});
