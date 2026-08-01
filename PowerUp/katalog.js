var t = TrelloPowerUp.iframe();
var katalog = [];

// Bisherige unterartikel.csv-Einträge als Startwert, falls im Board
// noch nichts gespeichert ist.
var STANDARD_KATALOG = [
  'Steckschaum', 'Blumendraht', 'Schleifenband rot', 'Schleifenband weiß',
  'Gruppenkarte', 'Vase (Glas)', 'Strauß bunt', 'Strauß rot', 'Strauß gelb'
];

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function speichernUndNeuZeichnen() {
  return t.set('board', 'shared', 'katalog', katalog).then(zeichnen);
}

function zeichnen() {
  var el = document.getElementById('liste');

  if (!katalog.length) {
    el.innerHTML = '<li style="justify-content: center; color: var(--text-light); font-style: italic;">Noch keine Einträge.</li>';
    t.sizeTo(document.body);
    return;
  }

  el.innerHTML = katalog.map(function (eintrag, i) {
    return '<li>' +
      '<span>' + escapeHtml(eintrag) + '</span>' +
      '<span class="loeschen" data-i="' + i + '">✕</span>' +
      '</li>';
  }).join('');

  el.querySelectorAll('.loeschen').forEach(function (btn) {
    btn.addEventListener('click', function () {
      katalog.splice(parseInt(btn.getAttribute('data-i'), 10), 1);
      speichernUndNeuZeichnen();
    });
  });

  t.sizeTo(document.body);
}

function hinzufuegen() {
  var feld = document.getElementById('neuer-eintrag');
  var wert = feld.value.trim();
  if (!wert) return;
  if (katalog.indexOf(wert) !== -1) {
    feld.value = '';
    return;
  }
  katalog.push(wert);
  katalog.sort(function (a, b) { return a.localeCompare(b, 'de'); });
  feld.value = '';
  feld.focus();
  speichernUndNeuZeichnen();
}

document.getElementById('hinzufuegen').addEventListener('click', hinzufuegen);
document.getElementById('neuer-eintrag').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') hinzufuegen();
});

t.render(function () {
  t.get('board', 'shared', 'katalog', STANDARD_KATALOG).then(function (gespeichert) {
    katalog = gespeichert;

    var context = t.getContext();
    if (context && context.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    zeichnen();
  });
});
