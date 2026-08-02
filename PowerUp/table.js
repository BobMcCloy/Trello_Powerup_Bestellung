/* global TrelloPowerUp, CONFIG */
var t = TrelloPowerUp.iframe({
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});
var lieferantenEinstellungen = null;
var currentMainIdForSub = null;
var katalogObjekte = [];
var editId = null;
var editSubId = null;

function neueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

function handleError(err) {
  console.error('API Error:', err);
  alert('Ein Fehler ist aufgetreten: ' + (err.message || err));
}

Promise.all([
  t.get('board', 'shared', 'lieferanten'),
  t.get('board', 'shared', 'katalog', STANDARD_KATALOG)
]).then(function(res) {
  lieferantenEinstellungen = res[0];
  var kat = res[1];

  var d1 = document.getElementById('lieferant');
  var d2 = document.getElementById('sub-lieferant');
  var html = '<option value="">- Kein Lieferant -</option>';
  if (lieferantenEinstellungen) {
    if (lieferantenEinstellungen.lief1 && lieferantenEinstellungen.lief1.name) html += '<option value="lief1">' + escapeHtml(lieferantenEinstellungen.lief1.name) + '</option>';
    if (lieferantenEinstellungen.lief2 && lieferantenEinstellungen.lief2.name) html += '<option value="lief2">' + escapeHtml(lieferantenEinstellungen.lief2.name) + '</option>';
  }
  if (d1) d1.innerHTML = html;
  if (d2) d2.innerHTML = html;

  katalogObjekte = kat.map(function(item) {
    if (typeof item === 'string') return { name: item, preis: '', lieferant: '' };
    return item;
  });

  var datalist = document.getElementById('katalog-liste');
  datalist.innerHTML = katalogObjekte.map(function(e) {
    var liefName = e.lieferant ? getLieferantName(e.lieferant) : '';
    var text = e.name + (liefName ? ' (' + liefName + ')' : '');
    return '<option value="' + escapeHtml(e.name) + '">' + escapeHtml(text) + '</option>';
  }).join('');
});

function getLieferantName(liefKey) {
  if (!liefKey) return '';
  if (lieferantenEinstellungen && lieferantenEinstellungen[liefKey]) {
    return lieferantenEinstellungen[liefKey].name;
  }
  return liefKey;
}

// updateCardLabels wurde nach utils.js (syncCardLabels) verschoben

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
  editId = null;
  editSubId = null;
  document.getElementById('speichern').textContent = 'Hinzufügen';
  document.getElementById('btn-sub-speichern').textContent = 'Hinzufügen';
  t.sizeTo(document.body);
};

function showError(element) {
  element.classList.remove('error-blink');
  void element.offsetWidth; // reflow
  element.classList.add('error-blink');
  element.focus();
}

document.getElementById('speichern').addEventListener('click', function () {
  var stkEl = document.getElementById('stk');
  var artEl = document.getElementById('artikel');
  var preisEl = document.getElementById('preis');
  
  var stk = stkEl.value;
  var artikel = artEl.value.trim();
  var preis = preisEl.value;
  var lieferant = document.getElementById('lieferant').value;

  if (!artikel) {
    showError(artEl);
    return;
  }
  var stkVal = parseInt(stk, 10);
  if (isNaN(stkVal) || stkVal <= 0) {
    showError(stkEl);
    return;
  }
  
  var pVal = parseFloat(preis.replace(',', '.'));
  if (isNaN(pVal) || pVal < 0) {
    showError(preisEl);
    return;
  }

  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    if (editId) {
      var item = produkte.find(p => p.id === editId);
      if (item) {
        item.stk = stk;
        item.produkt = artikel;
        item.preis = preis;
        item.lieferant = lieferant;
      }
    } else {
      produkte.push({ id: neueId(), stk: stk, produkt: artikel, preis: preis, lieferant: lieferant, unterartikel: [] });
    }
    syncCardLabels(t, t.getContext().card, produkte, lieferantenEinstellungen);
    return t.set('card', 'shared', 'produkte', produkte);
  }).then(function () {
    document.getElementById('stk').value = '1';
    document.getElementById('artikel').value = '';
    document.getElementById('preis').value = '';
    document.getElementById('lieferant').value = '';
    closeOverlays();
    zeichnen();
  }).catch(handleError);
});

window.addSub = function() {
  if (!currentMainIdForSub) return;

  var stkEl = document.getElementById('sub-stk');
  var artEl = document.getElementById('sub-art');
  var preisEl = document.getElementById('sub-preis');
  
  var stk = stkEl.value;
  var artikel = artEl.value.trim();
  var preis = preisEl.value;
  var lieferant = document.getElementById('sub-lieferant').value;
  var status = document.getElementById('sub-status').value;

  if (!artikel) {
    showError(artEl);
    return;
  }
  var stkVal = parseInt(stk, 10);
  if (isNaN(stkVal) || stkVal <= 0) {
    showError(stkEl);
    return;
  }
  
  var pVal = parseFloat(preis.replace(',', '.'));
  if (isNaN(pVal) || pVal < 0) {
    showError(preisEl);
    return;
  }

  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var main = produkte.find(p => p.id === currentMainIdForSub);
    if (!main) return produkte;
    if (!main.unterartikel) main.unterartikel = [];
    
    if (editSubId) {
      var sub = main.unterartikel.find(s => s.id === editSubId);
      if (sub) {
        sub.stk = stk;
        sub.produkt = artikel;
        sub.preis = preis;
        sub.lieferant = lieferant;
        sub.status = status;
      }
    } else {
      main.unterartikel.push({ id: neueId(), stk: stk, produkt: artikel, preis: preis, status: status, lieferant: lieferant });
    }
    
    syncCardLabels(t, t.getContext().card, produkte, lieferantenEinstellungen);
    return t.set('card', 'shared', 'produkte', produkte);
  }).then(function() {
    document.getElementById('sub-stk').value = '1';
    document.getElementById('sub-art').value = '';
    document.getElementById('sub-preis').value = '';
    document.getElementById('sub-lieferant').value = '';
    closeOverlays();
    zeichnen();
  }).catch(handleError);
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
    syncCardLabels(t, t.getContext().card, produkte, lieferantenEinstellungen);
    return t.set('card', 'shared', 'produkte', produkte);
  }).catch(handleError);
};

window.loeschen = function(id) {
  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var gefiltert = produkte.filter(p => p.id !== id);
    syncCardLabels(t, t.getContext().card, gefiltert, lieferantenEinstellungen);
    return t.set('card', 'shared', 'produkte', gefiltert);
  }).then(zeichnen).catch(handleError);
};

window.loeschenSub = function(mainId, subId) {
  t.get('card', 'shared', 'produkte', []).then(function (produkte) {
    var main = produkte.find(p => p.id === mainId);
    if (main && main.unterartikel) {
      main.unterartikel = main.unterartikel.filter(s => s.id !== subId);
    }
    syncCardLabels(t, t.getContext().card, produkte, lieferantenEinstellungen);
    return t.set('card', 'shared', 'produkte', produkte);
  }).then(zeichnen).catch(handleError);
};

window.editHaupt = function(id) {
  t.get('card', 'shared', 'produkte', []).then(function(produkte) {
    var p = produkte.find(item => item.id === id);
    if (!p) return;
    
    editId = p.id;
    document.getElementById('stk').value = p.stk || '1';
    document.getElementById('artikel').value = p.produkt || '';
    document.getElementById('preis').value = p.preis || '';
    document.getElementById('lieferant').value = p.lieferant || '';
    
    document.getElementById('speichern').textContent = 'Speichern';
    openHauptOverlay();
  });
};

window.editSub = function(mainId, subId) {
  t.get('card', 'shared', 'produkte', []).then(function(produkte) {
    var main = produkte.find(item => item.id === mainId);
    if (!main) return;
    var sub = (main.unterartikel || []).find(s => s.id === subId);
    if (!sub) return;
    
    currentMainIdForSub = mainId;
    editSubId = sub.id;
    
    document.getElementById('sub-stk').value = sub.stk || '1';
    document.getElementById('sub-art').value = sub.produkt || '';
    document.getElementById('sub-preis').value = sub.preis || '';
    document.getElementById('sub-lieferant').value = sub.lieferant || '';
    document.getElementById('sub-status').value = sub.status || 'vorhanden';
    
    document.getElementById('btn-sub-speichern').textContent = 'Speichern';
    openSubOverlay(mainId);
  }).catch(handleError);
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
    var html = `<div class="tabellen-rahmen">
      <table>
        <thead>
          <tr>
            <th class="w-30"></th>
            <th class="zahl">Stk</th>
            <th>Artikel</th>
            <th class="zahl">Preis</th>
            <th class="zahl">Summe</th>
            <th></th>
          </tr>
        </thead>
        <tbody>`;

    produkte.forEach(function (p, i) {
      var stk = parseFloat(p.stk) || 0;
      var preis = parseFloat(p.preis) || 0;
      var zwischensumme = stk * preis;
      var subs = p.unterartikel || [];

      var liefHtml = p.lieferant ? `<br><span class="lief-text">${escapeHtml(getLieferantName(p.lieferant))}</span>` : '';
      
      html += `<tr>
        <td><button id="btn-${i}" class="expand-btn" onclick="toggleSub(${i})">${subs.length > 0 ? '−' : '+'}</button></td>
        <td class="zahl">${stk}</td>
        <td><strong>${escapeHtml(p.produkt)}</strong>${liefHtml}</td>
        <td class="zahl"><span class="preis-pill">${formatEuro(preis)}</span></td>
        <td class="zahl">${formatEuro(zwischensumme)}</td>
        <td class="zahl">
          <div class="action-icons">
            <span class="icon-btn" onclick="editHaupt('${p.id}')" title="Bearbeiten">✏️</span>
            <span class="icon-btn-delete" onclick="loeschen('${p.id}')" title="Löschen">✕</span>
          </div>
        </td>
      </tr>`;

      html += `<tr><td colspan="6" class="no-pad-border">
              <div id="sub-${i}" class="sub-container" style="display:${subs.length > 0 ? 'block' : 'none'};">`;

      if (subs.length > 0) {
        html += `<table class="sub-table tabellen-rahmen"><tbody>`;
        subs.forEach(function(sub) {
           var subStk = parseFloat(sub.stk) || 0;
           var subPreis = parseFloat(sub.preis) || 0;
           zwischensumme += (subStk * subPreis);

           var subLiefHtml = sub.lieferant ? `<br><span class="sub-lief-text">${escapeHtml(getLieferantName(sub.lieferant))}</span>` : '';

           html += `<tr>
             <td class="zahl w-40">${subStk}x</td>
             <td>↳ ${escapeHtml(sub.produkt)}${subLiefHtml}</td>
             <td class="zahl">${formatEuro(subPreis)}</td>
             <td class="ws-nowrap">
               <select class="status-select" onchange="updateRadio('${p.id}', '${sub.id}', this.value)">
                 <option value="bestellen" ${sub.status === 'bestellen' ? 'selected' : ''}>Bestellen</option>
                 <option value="zulauf" ${sub.status === 'zulauf' ? 'selected' : ''}>Zulauf</option>
                 <option value="vorhanden" ${sub.status === 'vorhanden' ? 'selected' : ''}>Vorhanden</option>
               </select>
             </td>
             <td class="zahl">
               <div class="action-icons">
                 <span class="icon-btn" onclick="editSub('${p.id}', '${sub.id}')" title="Bearbeiten">✏️</span>
                 <span class="icon-btn-delete" onclick="loeschenSub('${p.id}', '${sub.id}')" title="Löschen">✕</span>
               </div>
             </td>
           </tr>`;
        });
        html += `</tbody></table>`;
      }
      gesamt += zwischensumme;

      html += `<button class="btn-hinzufuegen btn-small mt-5" onclick="openSubOverlay('${p.id}')">+ Unterartikel hinzufügen</button>`;
      html += `</div></td></tr>`;
    });

    html += `</tbody>
      <tfoot>
        <tr>
          <td colspan="4"></td>
          <td class="zahl">Gesamt</td>
          <td class="zahl">${formatEuro(gesamt)}</td>
        </tr>
      </tfoot>
    </table></div>`;
    
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

function attachAutoFill(inputId, preisId, liefId) {
  var inputEl = document.getElementById(inputId);
  if (!inputEl) return;
  inputEl.addEventListener('input', function() {
    var val = inputEl.value.trim();
    var found = katalogObjekte.find(k => k.name === val);
    if (found) {
      if (found.preis && !document.getElementById(preisId).value) {
        document.getElementById(preisId).value = found.preis;
      }
      if (found.lieferant && !document.getElementById(liefId).value) {
        document.getElementById(liefId).value = found.lieferant;
      }
    }
  });
}

attachAutoFill('artikel', 'preis', 'lieferant');
attachAutoFill('sub-art', 'sub-preis', 'sub-lieferant');

['stk', 'artikel', 'preis', 'lieferant'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('speichern').click();
      }
    });
  }
});

['sub-stk', 'sub-art', 'sub-preis', 'sub-lieferant'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.addSub();
      }
    });
  }
});
document.getElementById('sub-status').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    window.addSub();
  }
});
