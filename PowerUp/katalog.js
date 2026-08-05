(function() {
/* global TrelloPowerUp, CONFIG, escapeHtml, escapeHtmlAttr, formatEuro, getLieferantName, normalizeLieferantenEinstellungen, showToast, handleError */
const t = TrelloPowerUp.iframe({
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});

let katalogProdukte = [];
let katalogMaterial = [];
let lieferantenEinstellungen = null;
let editIndex = null;
let activeTab = 'produkte'; // 'produkte' oder 'material'
let isSavingInline = false;

function getActiveArray() {
  return activeTab === 'produkte' ? katalogProdukte : katalogMaterial;
}

function speichernUndNeuZeichnen() {
  return t.set('board', 'shared', {
    katalogProdukte: katalogProdukte,
    katalogMaterial: katalogMaterial
  }).then(zeichnen).catch(handleError);
}

function renderLiefOptions(selected) {
  let html = '<option value="">- Kein Lieferant -</option>';
  lieferantenEinstellungen.forEach(lief => {
    if (lief.name) {
      html += `<option value="${escapeHtmlAttr(lief.id)}" ${lief.id === selected ? 'selected' : ''}>${escapeHtml(lief.name)}</option>`;
    }
  });
  return html;
}

function zeichnen() {
  const el = document.getElementById('liste');
  const aktiverKatalog = getActiveArray();

  let quickCount = 0;
  if (activeTab === 'produkte') {
    quickCount = aktiverKatalog.filter(e => e && e.isQuickButton).length;
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
        <button class="btn-speichern-inline" data-idx="new">Speichern</button>
        <span class="loeschen" style="margin-left:8px;" data-action="cancel">Abbrechen</span>
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
          <td><input type="text" id="inline-name-${i}" class="inline-input" value="${escapeHtmlAttr(eName)}"></td>
          ${showFav ? '<td></td>' : `<td><select id="inline-lief-${i}" class="inline-input">${renderLiefOptions(eLief)}</select></td>`}
          <td><input type="number" id="inline-preis-${i}" class="inline-input" value="${escapeHtmlAttr(ePreis)}" step="0.01"></td>
          <td class="katalog-actions">
            <button class="btn-speichern-inline" data-idx="${i}">Speichern</button>
            <span class="loeschen" style="margin-left:8px;" data-action="cancel">Abbrechen</span>
          </td>
        </tr>`;
        return row;
      }

      var ePreisDisp = ePreis ? formatEuro(ePreis) : '';
      var eLiefDisp = eLief ? getLieferantName(eLief, lieferantenEinstellungen) : '';
      
      var row = `<tr>`;
      if (showFav) {
        var disabledAttr = (!isQ && quickCount >= 6) ? 'disabled' : '';
        row += `<td style="text-align: center;"><input type="checkbox" class="fav-check" data-idx="${i}" ${isQ ? 'checked' : ''} ${disabledAttr}></td>`;
      }
      
      row += `
        <td><strong>${escapeHtml(eName)}</strong></td>
        <td>${showFav ? '' : escapeHtml(eLiefDisp)}</td>
        <td class="zahl">${escapeHtml(ePreisDisp)}</td>
        <td class="katalog-actions">
          <span class="bearbeiten" data-idx="${i}" title="Bearbeiten">Bearbeiten</span>
          <span class="loeschen" data-action="delete" data-idx="${i}" title="Löschen">Löschen</span>
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

  if (editIndex !== null) {
    const targetId = editIndex === 'new' ? 'inline-name-new' : 'inline-name-' + editIndex;
    const focusTask = function() {
      const inputEl = document.getElementById(targetId);
      if (inputEl) {
        inputEl.focus();
        if (typeof inputEl.select === 'function') inputEl.select();
      }
    };
    requestAnimationFrame(focusTask);
    setTimeout(focusTask, 50);
  }
}

function toggleQuickBtn(index, isChecked) {
  var aktiverKatalog = getActiveArray();
  if (aktiverKatalog[index]) {
    if (typeof aktiverKatalog[index] === 'string') {
      aktiverKatalog[index] = { name: aktiverKatalog[index] };
    }
    aktiverKatalog[index].isQuickButton = isChecked;
    speichernUndNeuZeichnen();
  }
}

function startEdit(index) {
  editIndex = index;
  zeichnen();
}

function cancelEdit() {
  editIndex = null;
  zeichnen();
}

function loeschenEintrag(index) {
  getActiveArray().splice(index, 1);
  speichernUndNeuZeichnen();
}

function speichernInline(index) {
  if (isSavingInline) return;
  isSavingInline = true;

  var aktiverKatalog = getActiveArray();
  var nameEl = document.getElementById('inline-name-' + index);
  var preisEl = document.getElementById('inline-preis-' + index);
  var liefEl = document.getElementById('inline-lief-' + index);

  var wert = nameEl ? nameEl.value.trim() : '';
  var preis = preisEl ? preisEl.value.trim().replace(',', '.') : '';
  var lief = liefEl ? liefEl.value : '';

  if (!wert) {
    nameEl.focus();
    isSavingInline = false;
    return;
  }

  if (preis !== '') {
    var pVal = parseFloat(preis);
    if (isNaN(pVal) || pVal < 0) {
      preisEl.focus();
      isSavingInline = false;
      return;
    }
  }

  // Check if name already exists
  var exists = aktiverKatalog.findIndex(function (k) {
    var kName = typeof k === 'string' ? k : k.name;
    return kName.trim().toLowerCase() === wert.toLowerCase();
  });

  if (exists !== -1 && exists !== (index === 'new' ? -1 : parseInt(index, 10))) {
    showToast('Dieser Artikel existiert bereits in dieser Liste.', true);
    nameEl.focus();
    isSavingInline = false;
    return;
  }

  var itemData = { name: wert, preis: preis, lieferant: lief };
  
  if (index === 'new') {
    aktiverKatalog.push(itemData);
  } else {
    var idxNum = parseInt(index, 10);
    var oldItem = aktiverKatalog[idxNum];
    if (typeof oldItem === 'object' && oldItem.isQuickButton) {
      itemData.isQuickButton = true;
    }
    aktiverKatalog[idxNum] = itemData;
  }

  aktiverKatalog.sort(function (a, b) {
    var nameA = typeof a === 'string' ? a : a.name;
    var nameB = typeof b === 'string' ? b : b.name;
    return nameA.localeCompare(nameB, 'de');
  });

  editIndex = null;
  speichernUndNeuZeichnen().then(() => {
    isSavingInline = false;
  }).catch(err => {
    isSavingInline = false;
    handleError(err);
  });
}

document.getElementById('liste').addEventListener('click', function(e) {
  var btn = e.target;
  if (btn.classList.contains('btn-speichern-inline')) {
    speichernInline(btn.dataset.idx);
  } else if (btn.classList.contains('loeschen') && btn.dataset.action === 'cancel') {
    cancelEdit();
  } else if (btn.classList.contains('bearbeiten')) {
    startEdit(parseInt(btn.dataset.idx, 10));
  } else if (btn.classList.contains('loeschen') && btn.dataset.action === 'delete') {
    loeschenEintrag(parseInt(btn.dataset.idx, 10));
  }
});

document.getElementById('liste').addEventListener('change', function(e) {
  if (e.target.classList.contains('fav-check')) {
    toggleQuickBtn(parseInt(e.target.dataset.idx, 10), e.target.checked);
  }
});

document.addEventListener('keydown', function(e) {
  if ((e.key === 'Enter' || e.keyCode === 13) && e.target && e.target.classList && e.target.classList.contains('inline-input')) {
    e.preventDefault();
    e.stopPropagation();
    const idStr = e.target.id;
    if (idStr && idStr.startsWith('inline-')) {
      const parts = idStr.split('-');
      const idx = parts[parts.length - 1];
      speichernInline(idx);
    }
  }
});

document.getElementById('btn-neu-zeile').addEventListener('click', function(e) {
  if (e) e.preventDefault();
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

    lieferantenEinstellungen = normalizeLieferantenEinstellungen(rawLief);

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
})();
