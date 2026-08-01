var t = TrelloPowerUp.iframe();
var currentMainIdForSub = null;
var STANDARD_KATALOG = [
  'Steckschaum', 'Blumendraht', 'Schleifenband rot', 'Schleifenband weiß',
  'Gruppenkarte', 'Vase (Glas)', 'Strauß bunt', 'Strauß rot', 'Strauß gelb'
];

function neueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

function formatEuro(n) { return (parseFloat(n) || 0).toFixed(2).replace('.', ',') + ' €'; }

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = String(str || '');
  return div.innerHTML;
}

t.get('board', 'shared', 'katalog', STANDARD_KATALOG).then(function (kat) {
  var datalist = document.getElementById('katalog-liste');
  datalist.innerHTML = kat.map(e => '<option value="' + escapeHtml(e) + '">').join('');
});

window.openHauptOverlay = function() {
  document.body.style.minHeight = '300px';
  document.getElementById('overlay-haupt').style.display = 'flex';
  setTimeout(() => document.getElementById('artikel').focus(), 50);
  t.sizeTo(document.body);
};

window.openSubOverlay = function(id) {
  currentMainIdForSub = id;
  document.body.style.minHeight = '400px';
  document.getElementById('overlay-sub').style.display = 'flex';
  setTimeout(() => document.getElementById('sub-art').focus(), 50);
  t.sizeTo(document.body);
};

window.closeOverlays = function() {
  document.getElementById('overlay-haupt').style.display = 'none';
  document.getElementById('overlay-sub').style.display = 'none';
  document.body.style.minHeight = 'auto';
  currentMainIdForSub = null;
  t.sizeTo(document.body);
};

document.getElementById('speichern').addEventListener('click', function () {
  var stk = document.getElementById('stk').value;
  var artikel = document.getElementById('artikel').value.trim();
  var preis = document.getElementById('preis').value;

  if (!artikel || preis === '' || !stk) return;

  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    produkte.push({ id: neueId(), stk: stk, produkt: artikel, preis: preis, unterartikel: [] });
    return t.set('card', 'shared', 'produkte', produkte);
  }).then(function () {
    document.getElementById('stk').value = '1';
    document.getElementById('artikel').value = '';
    document.getElementById('preis').value = '';
    closeOverlays();
    zeichnen();
  });
});

window.addSub = function() {
  if (!currentMainIdForSub) return;

  var stk = document.getElementById('sub-stk').value;
  var artikel = document.getElementById('sub-art').value.trim();
  var preis = document.getElementById('sub-preis').value;
  var status = document.querySelector('input[name="new-radio-sub"]:checked').value;

  if (!artikel || preis === '' || !stk) return;

  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var main = produkte.find(p => p.id === currentMainIdForSub);
    if (!main) return produkte;
    if (!main.unterartikel) main.unterartikel = [];
    main.unterartikel.push({ id: neueId(), stk: stk, produkt: artikel, preis: preis, status: status });
    return t.set('card', 'shared', 'produkte', produkte);
  }).then(function() {
    document.getElementById('sub-stk').value = '1';
    document.getElementById('sub-art').value = '';
    document.getElementById('sub-preis').value = '';
    closeOverlays();
    zeichnen();
  });
};

window.toggleSub = function(index) {
  var el = document.getElementById('sub-' + index);
  var btn = document.getElementById('btn-' + index);
  var isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '−' : '+';
  t.sizeTo(document.body);
};

window.updateRadio = function(mainId, subId, neuerStatus) {
  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var main = produkte.find(p => p.id === mainId);
    if (!main) return;
    var sub = (main.unterartikel || []).find(s => s.id === subId);
    if (!sub) return;
    sub.status = neuerStatus;
    return t.set('card', 'shared', 'produkte', produkte);
  });
};

window.loeschen = function(id) {
  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var gefiltert = produkte.filter(p => p.id !== id);
    return t.set('card', 'shared', 'produkte', gefiltert);
  }).then(zeichnen);
};

window.loeschenSub = function(mainId, subId) {
  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var main = produkte.find(p => p.id === mainId);
    if (main && main.unterartikel) {
      main.unterartikel = main.unterartikel.filter(s => s.id !== subId);
    }
    return t.set('card', 'shared', 'produkte', produkte);
  }).then(zeichnen);
};

function zeichnen() {
  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var el = document.getElementById('inhalt');

    if (!produkte.length) {
      el.innerHTML = '<div class="leer">Noch keine Artikel vorhanden.</div>';
      t.sizeTo(document.body);
      return;
    }

    var gesamt = 0;
    var html = '<div class="tabellen-rahmen"><table><thead><tr><th style="width: 30px;"></th><th class="zahl">Stk</th><th>Artikel</th><th class="zahl">Preis</th><th class="zahl">Summe</th><th></th></tr></thead><tbody>';

    produkte.forEach(function (p, i) {
      var stk = parseFloat(p.stk) || 0;
      var preis = parseFloat(p.preis) || 0;
      var zwischensumme = stk * preis;
      var subs = p.unterartikel || [];

      html += '<tr>' +
        '<td><button id="btn-' + i + '" class="expand-btn" onclick="toggleSub(' + i + ')">' + (subs.length > 0 ? '−' : '+') + '</button></td>' +
        '<td class="zahl">' + stk + '</td>' +
        '<td><strong>' + escapeHtml(p.produkt) + '</strong></td>' +
        '<td class="zahl"><span class="preis-pill">' + formatEuro(preis) + '</span></td>' +
        '<td class="zahl">' + formatEuro(zwischensumme) + '</td>' +
        '<td class="zahl"><span class="loeschen" onclick="loeschen(\'' + p.id + '\')">✕</span></td>' +
        '</tr>';

      html += '<tr><td colspan="6" style="padding: 0; border: none;">' +
              '<div id="sub-' + i + '" class="sub-container" style="display:' + (subs.length > 0 ? 'block' : 'none') + ';">';

      if (subs.length > 0) {
        html += '<table class="sub-table tabellen-rahmen"><tbody>';
        subs.forEach(function(sub) {
           var subStk = parseFloat(sub.stk) || 0;
           var subPreis = parseFloat(sub.preis) || 0;
           zwischensumme += (subStk * subPreis);

           var rName = 'status_' + sub.id;

           html += '<tr>' +
             '<td class="zahl" style="width: 40px;">' + subStk + 'x</td>' +
             '<td>↳ ' + escapeHtml(sub.produkt) + '</td>' +
             '<td class="zahl">' + formatEuro(subPreis) + '</td>' +
             '<td>' +
               '<div class="radio-group">' +
                 '<label class="radio-label"><input type="radio" name="' + rName + '" value="bestellen" onchange="updateRadio(\'' + p.id + '\',\'' + sub.id + '\',\'bestellen\')" ' + (sub.status === 'bestellen' ? 'checked' : '') + '> Bestellen</label>' +
                 '<label class="radio-label"><input type="radio" name="' + rName + '" value="zulauf" onchange="updateRadio(\'' + p.id + '\',\'' + sub.id + '\',\'zulauf\')" ' + (sub.status === 'zulauf' ? 'checked' : '') + '> Zulauf</label>' +
                 '<label class="radio-label"><input type="radio" name="' + rName + '" value="vorhanden" onchange="updateRadio(\'' + p.id + '\',\'' + sub.id + '\',\'vorhanden\')" ' + (sub.status === 'vorhanden' ? 'checked' : '') + '> Vorhanden</label>' +
               '</div>' +
             '</td>' +
             '<td class="zahl"><span class="loeschen" onclick="loeschenSub(\'' + p.id + '\',\'' + sub.id + '\')">✕</span></td>' +
             '</tr>';
        });
        html += '</tbody></table>';
      }
      gesamt += zwischensumme;

      html += '<button class="btn-hinzufuegen" style="font-size: 12px; height: 28px; padding: 4px 10px;" onclick="openSubOverlay(\'' + p.id + '\')">+ Unterartikel hinzufügen</button>';
      html += '</div></td></tr>';
    });

    html += '</tbody><tfoot><tr><td colspan="4"></td><td class="zahl">Gesamt</td><td class="zahl">' + formatEuro(gesamt) + '</td></tr></tfoot></table></div>';
    el.innerHTML = html;
    t.sizeTo(document.body);
  });
}

t.render(function () {
  var context = t.getContext();
  if (context && context.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  zeichnen();
});
