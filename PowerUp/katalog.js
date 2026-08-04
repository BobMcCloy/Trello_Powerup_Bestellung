/* global TrelloPowerUp, CONFIG */
var t = TrelloPowerUp.iframe({
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});

var katalogProdukte = [];
var katalogMaterial = [];
var lieferantenEinstellungen = null;
var editIndex = null;
var activeTab = 'produkte'; // 'produkte' oder 'material'

function getLieferantName(liefKey) {
  if (!liefKey) return 'Kein Lieferant';
  var found = lieferantenEinstellungen.find(l => l.id === liefKey);
  if (found) return found.name;
  return liefKey;
}

function getActiveArray() {
  return activeTab === 'produkte' ? katalogProdukte : katalogMaterial;
}

function speichernUndNeuZeichnen() {
  return t.set('board', 'shared', {
    katalogProdukte: katalogProdukte,
    katalogMaterial: katalogMaterial
  }).then(zeichnen).catch(handleError);
}

function handleError(err) {
  console.error(err);
}

function renderLiefOptions(selected) {
  var html = '<option value="">- Kein Lieferant -</option>';
  lieferantenEinstellungen.forEach(function (lief) {
    if (lief.name) {
      html += `<option value="${escapeHtml(lief.id)}" ${lief.id === selected ? 'selected' : ''}>${escapeHtml(lief.name)}</option>`;
    }
  });
  return html;
}

function zeichnen() {
  var el = document.getElementById('liste');
  var aktiverKatalog = getActiveArray();

  var quickCount = 0;
  if (activeTab === 'produkte') {
    quickCount = aktiverKatalog.filter(function(e) { return e && e.isQuickButton; }).length;
  }

  var html = '';

  if (editIndex === 'new') {
    var showFav = activeTab === 'produkte';
    html += `<tr>`;
    if (showFav) html += `<td style="text-align: center;"></td>`;
    html += `
      <td><input type="text" id="inline-name-new" class="inline-input" placeholder="Name"></td>
      ${showFav ? '<td></td>' : `<td><select id="inline-lief-new" class="inline-input">${renderLiefOptions('')}</select></td>`}
      <td><input type="number" id="inline-preis-new" class="inline-input" placeholder="Preis" step="0.01"></td>
      <td class="katalog-actions">
        <button class="btn-speichern-inline" onclick="speichernInline('new')">Speichern</button>
        <span class="loeschen" style="margin-left:8px;" onclick="cancelEdit()">Abbrechen</span>
      </td>
    </tr>`;
  }

  if (!aktiverKatalog.length && editIndex !== 'new') {
    html += '<tr><td colspan="5" class="empty-state">Noch keine Einträge in diesem Bereich.</td></tr>';
  } else {
    html += aktiverKatalog.map(function (eintrag, i) {
      var eName = typeof eintrag === 'string' ? eintrag : eintrag.name;
      var ePreis = (typeof eintrag === 'object' && eintrag.preis) ? eintrag.preis : '';
      var eLief = (typeof eintrag === 'object' && eintrag.lieferant) ? eintrag.lieferant : '';
      var isQ = (typeof eintrag === 'object' && eintrag.isQuickButton) ? true : false;
      var showFav = activeTab === 'produkte';

      if (i === editIndex) {
        var row = `<tr>`;
        if (showFav) row += `<td style="text-align: center;"></td>`;
        row += `
          <td><input type="text" id="inline-name-${i}" class="inline-input" value="${escapeHtml(eName)}"></td>
          ${showFav ? '<td></td>' : `<td><select id="inline-lief-${i}" class="inline-input">${renderLiefOptions(eLief)}</select></td>`}
          <td><input type="number" id="inline-preis-${i}" class="inline-input" value="${ePreis}" step="0.01"></td>
          <td class="katalog-actions">
            <button class="btn-speichern-inline" onclick="speichernInline(${i})">Speichern</button>
            <span class="loeschen" style="margin-left:8px;" onclick="cancelEdit()">Abbrechen</span>
          </td>
        </tr>`;
        return row;
      }

      var ePreisDisp = ePreis ? formatEuro(ePreis) : '';
      var eLiefDisp = eLief ? getLieferantName(eLief) : '';
      
      var row = `<tr>`;
      if (showFav) {
        var disabledAttr = (!isQ && quickCount >= 6) ? 'disabled' : '';
        row += `<td style="text-align: center;"><input type="checkbox" class="fav-check" onchange="toggleQuickBtn(${i}, this.checked)" ${isQ ? 'checked' : ''} ${disabledAttr}></td>`;
      }
      
      row += `
        <td><strong>${escapeHtml(eName)}</strong></td>
        <td>${showFav ? '' : escapeHtml(eLiefDisp)}</td>
        <td class="zahl">${escapeHtml(ePreisDisp)}</td>
        <td class="katalog-actions">
          <span class="bearbeiten" onclick="startEdit(${i})" title="Bearbeiten">Bearbeiten</span>
          <span class="loeschen" onclick="loeschenEintrag(${i})" title="Löschen">Löschen</span>
        </td>
      </tr>`;
      return row;
    }).join('');
  }

  el.innerHTML = html;
  
  // Update Header depending on tab
  var thFav = document.getElementById('th-fav');
  var thLief = document.getElementById('th-lief');
  if (activeTab === 'produkte') {
    if (thFav) thFav.style.display = 'table-cell';
    if (thLief) thLief.textContent = ''; // Hide header content for products since they don't have suppliers
  } else {
    if (thFav) thFav.style.display = 'none';
    if (thLief) thLief.textContent = 'Std. Lieferant';
  }

  t.sizeTo(document.body);
}

window.toggleQuickBtn = function(index, isChecked) {
  var aktiverKatalog = getActiveArray();
  if (aktiverKatalog[index]) {
    if (typeof aktiverKatalog[index] === 'string') {
      aktiverKatalog[index] = { name: aktiverKatalog[index] };
    }
    aktiverKatalog[index].isQuickButton = isChecked;
    speichernUndNeuZeichnen();
  }
};

window.startEdit = function(index) {
  editIndex = index;
  zeichnen();
};

window.cancelEdit = function() {
  editIndex = null;
  zeichnen();
};

window.loeschenEintrag = function(index) {
  getActiveArray().splice(index, 1);
  speichernUndNeuZeichnen();
};

window.speichernInline = function(index) {
  var aktiverKatalog = getActiveArray();
  var nameEl = document.getElementById('inline-name-' + index);
  var preisEl = document.getElementById('inline-preis-' + index);
  var liefEl = document.getElementById('inline-lief-' + index);

  var wert = nameEl ? nameEl.value.trim() : '';
  var preis = preisEl ? preisEl.value.trim().replace(',', '.') : '';
  var lief = liefEl ? liefEl.value : '';

  if (!wert) {
    nameEl.focus();
    return;
  }

  if (preis !== '') {
    var pVal = parseFloat(preis);
    if (isNaN(pVal) || pVal < 0) {
      preisEl.focus();
      return;
    }
  }

  // Check if name already exists
  var exists = aktiverKatalog.findIndex(function (k) {
    var kName = typeof k === 'string' ? k : k.name;
    return kName.trim().toLowerCase() === wert.toLowerCase();
  });

  if (exists !== -1 && exists !== index) {
    alert('Dieser Artikel existiert bereits in dieser Liste.');
    nameEl.focus();
    return;
  }

  var itemData = { name: wert, preis: preis, lieferant: lief };
  
  if (index === 'new') {
    aktiverKatalog.push(itemData);
  } else {
    var oldItem = aktiverKatalog[index];
    if (typeof oldItem === 'object' && oldItem.isQuickButton) {
      itemData.isQuickButton = true;
    }
    aktiverKatalog[index] = itemData;
  }

  aktiverKatalog.sort(function (a, b) {
    var nameA = typeof a === 'string' ? a : a.name;
    var nameB = typeof b === 'string' ? b : b.name;
    return nameA.localeCompare(nameB, 'de');
  });

  editIndex = null;
  speichernUndNeuZeichnen();
};

document.getElementById('btn-neu-zeile').addEventListener('click', function() {
  editIndex = 'new';
  zeichnen();
});

// Event Listeners for Tabs
document.getElementById('tab-produkte').addEventListener('click', function() {
  activeTab = 'produkte';
  editIndex = null;
  document.getElementById('tab-produkte').classList.add('active');
  document.getElementById('tab-material').classList.remove('active');
  zeichnen();
});

document.getElementById('tab-material').addEventListener('click', function() {
  activeTab = 'material';
  editIndex = null;
  document.getElementById('tab-material').classList.add('active');
  document.getElementById('tab-produkte').classList.remove('active');
  zeichnen();
});

t.render(function () {
  Promise.all([
    t.get('board', 'shared', 'katalogProdukte'),
    t.get('board', 'shared', 'katalogMaterial'),
    t.get('board', 'shared', 'katalog'), // fallback for migration
    t.get('board', 'shared', 'lieferanten')
  ]).then(function (res) {
    var storedProdukte = res[0];
    var storedMaterial = res[1];
    var oldKatalog = res[2];
    var rawLief = res[3];

    lieferantenEinstellungen = [];
    if (rawLief && typeof rawLief === 'object' && !Array.isArray(rawLief)) {
      if (rawLief.lief1 && rawLief.lief1.name) lieferantenEinstellungen.push({ id: 'lief1', name: rawLief.lief1.name });
      if (rawLief.lief2 && rawLief.lief2.name) lieferantenEinstellungen.push({ id: 'lief2', name: rawLief.lief2.name });
    } else if (Array.isArray(rawLief)) {
      lieferantenEinstellungen = rawLief;
    }

    // Migration logic
    if (!storedProdukte && !storedMaterial && oldKatalog && oldKatalog.length > 0) {
      oldKatalog.forEach(function(item) {
        var isObj = typeof item === 'object';
        var hasLief = isObj && item.lieferant && item.lieferant.trim() !== '';
        var migratedItem = isObj ? item : { name: item, preis: '', lieferant: '' };
        if (hasLief) {
          katalogMaterial.push(migratedItem);
        } else {
          katalogProdukte.push(migratedItem);
        }
      });
      t.set('board', 'shared', { katalogProdukte: katalogProdukte, katalogMaterial: katalogMaterial });
    } else {
      katalogProdukte = storedProdukte || [];
      katalogMaterial = storedMaterial || [];
    }

    var context = t.getContext();
    if (context && context.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    zeichnen();
  });
});
