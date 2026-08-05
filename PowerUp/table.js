/* global TrelloPowerUp, CONFIG, escapeHtml, escapeHtmlAttr, getLieferantName, handleError, formatEuro, persistProdukte, showToast */
(function() {
  var t = TrelloPowerUp.iframe({
    appKey: typeof CONFIG !== 'undefined' ? CONFIG.TRELLO_APP_KEY : (typeof APP_KEY !== 'undefined' ? APP_KEY : ''),
    appName: 'Blumenladen Produktliste'
  });
  
  let lieferantenEinstellungen = null;
  let currentMainIdForSub = null;
  let katalogObjekte = [];
  let editId = null;
  let editSubId = null;
  let letzterHauptartikelId = null;
  let isSaving = false;

  function neueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  }

  Promise.all([
    t.get('board', 'shared', 'lieferanten'),
    t.get('board', 'shared', 'katalogProdukte', []),
    t.get('board', 'shared', 'katalogMaterial', [])
  ]).then(function (res) {
    var rawLief = res[0];
    lieferantenEinstellungen = normalizeLieferantenEinstellungen(rawLief);

    var katProd = res[1];
    var katMat = res[2];

    var d2 = document.getElementById('sub-lieferant');
    var html = '<option value="">- Kein Lieferant -</option>';
    lieferantenEinstellungen.forEach(function (lief) {
      if (lief.name) {
        html += '<option value="' + escapeHtmlAttr(lief.id) + '">' + escapeHtml(lief.name) + '</option>';
      }
    });
    if (d2) d2.innerHTML = html;

    var prodDatalist = document.getElementById('katalog-produkte-liste');
    if (prodDatalist) {
      prodDatalist.innerHTML = katProd.map(function (e) {
        var liefName = e.lieferant ? getLieferantName(e.lieferant, lieferantenEinstellungen) : '';
        var text = e.name + (liefName ? ' (' + liefName + ')' : '');
        return '<option value="' + escapeHtmlAttr(e.name) + '">' + escapeHtml(text) + '</option>';
      }).join('');
    }

    var matDatalist = document.getElementById('katalog-material-liste');
    if (matDatalist) {
      matDatalist.innerHTML = katMat.map(function (e) {
        var liefName = e.lieferant ? getLieferantName(e.lieferant, lieferantenEinstellungen) : '';
        var text = e.name + (liefName ? ' (' + liefName + ')' : '');
        return '<option value="' + escapeHtmlAttr(e.name) + '">' + escapeHtml(text) + '</option>';
      }).join('');
    }

    var quickBtnContainer = document.getElementById('quick-buttons-container');
    if (quickBtnContainer) {
      var quickBtns = katProd.filter(p => p.isQuickButton);
      if (quickBtns.length > 0) {
        quickBtnContainer.style.display = 'grid';
        quickBtnContainer.innerHTML = '';
        quickBtns.forEach(function(qb) {
          var btn = document.createElement('button');
          btn.className = 'quick-btn';
          btn.title = qb.name;
          btn.textContent = qb.name;
          var p = (parseFloat(qb.preis) || 0).toFixed(2);
          btn.addEventListener('click', function() {
            document.getElementById('artikel').value = qb.name;
            document.getElementById('preis').value = p;
            document.getElementById('stk').focus();
          });
          quickBtnContainer.appendChild(btn);
        });
      } else {
        quickBtnContainer.style.display = 'none';
      }
    }
    katalogObjekte = katProd.concat(katMat);
  });

  function openOverlay(type, mainId = null) {
    if (type === 'haupt') {
      document.body.style.minHeight = '300px';
      document.getElementById('overlay-haupt').style.display = 'flex';
      if (!editId) {
        document.getElementById('stk').value = '1';
        document.getElementById('artikel').value = '';
        document.getElementById('preis').value = '';
      }
      setTimeout(() => document.getElementById('artikel').focus(), 50);
    } else if (type === 'sub') {
      letzterHauptartikelId = mainId;
      currentMainIdForSub = mainId;
      document.body.style.minHeight = '400px';
      document.getElementById('overlay-sub').style.display = 'flex';
      if (!editSubId) {
        document.getElementById('sub-stk').value = '1';
        document.getElementById('sub-art').value = '';
        document.getElementById('sub-preis').value = '';
        document.getElementById('sub-lieferant').value = '';
        document.getElementById('sub-status').value = 'vorhanden';
      }
      setTimeout(() => document.getElementById('sub-stk').focus(), 50);
    }
    t.sizeTo(document.body);
  }

  function closeOverlays() {
    document.getElementById('overlay-haupt').style.display = 'none';
    document.getElementById('overlay-sub').style.display = 'none';
    document.body.style.minHeight = 'auto';
    currentMainIdForSub = null;
    editId = null;
    editSubId = null;
    document.getElementById('speichern').textContent = 'Hinzufügen';
    document.getElementById('btn-sub-speichern').textContent = 'Hinzufügen';
    t.sizeTo(document.body);
  }

  function showError(element) {
    element.classList.remove('error-blink');
    void element.offsetWidth;
    element.classList.add('error-blink');
    element.focus();
  }

  function validateForm(stkEl, artEl, preisEl) {
    var stk = stkEl.value.trim();
    var artikel = artEl.value.trim();
    var preis = preisEl.value.trim();

    if (!artikel) return { el: artEl };
    if (!stk || !/^\d+$/.test(stk) || Number(stk) <= 0) return { el: stkEl };
    
    var preisCents = 0;
    if (preis !== '') {
      var clean = preis;
      if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
          clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else {
        clean = clean.replace(',', '.');
      }
      var pVal = parseFloat(clean);
      if (isNaN(pVal) || pVal < 0) return { el: preisEl };
      preisCents = Math.round(pVal * 100);
      preis = (preisCents / 100).toFixed(2);
    }

    return { valid: true, stk: stk, artikel: artikel, preis: preis };
  }

  document.getElementById('speichern').addEventListener('click', function () {
    var res = validateForm(
      document.getElementById('stk'),
      document.getElementById('artikel'),
      document.getElementById('preis')
    );
    if (!res.valid) { showError(res.el); return; }

    t.get('card', 'shared', 'produkte', []).then(function (produkte) {
      if (editId) {
        letzterHauptartikelId = editId;
        var exist = produkte.find(p => p.id === editId);
        if (exist) {
          exist.stk = res.stk;
          exist.produkt = res.artikel;
          exist.preis = res.preis;
          exist.lieferant = '';
        }
      } else {
        var nId = neueId();
        letzterHauptartikelId = nId;
        produkte.push({ id: nId, stk: res.stk, produkt: res.artikel, preis: res.preis, lieferant: '', unterartikel: [] });
      }
      return persistProdukte(t, t.getContext().card, produkte);
    }).then(function () {
      closeOverlays();
      zeichnen();
    }).catch(handleError);
  });

  document.getElementById('btn-sub-speichern').addEventListener('click', function () {
    if (!currentMainIdForSub) return;
    
    var res = validateForm(
      document.getElementById('sub-stk'),
      document.getElementById('sub-art'),
      document.getElementById('sub-preis')
    );
    if (!res.valid) { showError(res.el); return; }

    var lieferant = document.getElementById('sub-lieferant').value;
    var status = document.getElementById('sub-status').value;

    t.get('card', 'shared', 'produkte', []).then(function (produkte) {
      var main = produkte.find(p => p.id === currentMainIdForSub);
      if (!main) return produkte;
      if (!main.unterartikel) main.unterartikel = [];

      if (editSubId) {
        var sub = main.unterartikel.find(s => s.id === editSubId);
        if (sub) {
          sub.stk = res.stk;
          sub.produkt = res.artikel;
          sub.preis = res.preis;
          sub.lieferant = lieferant;
          sub.status = status;
        }
      } else {
        main.unterartikel.push({ id: neueId(), stk: res.stk, produkt: res.artikel, preis: res.preis, status: status, lieferant: lieferant });
      }

      return persistProdukte(t, t.getContext().card, produkte);
    }).then(function () {
      closeOverlays();
      zeichnen();
    }).catch(handleError);
  });

  function toggleSub(index) {
    var el = document.getElementById('sub-' + index);
    var btn = document.getElementById('btn-' + index);
    var isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    btn.textContent = isHidden ? '−' : '+';
    t.sizeTo(document.body);
  }

  function updateRadio(mainId, subId, neuerStatus) {
    isSaving = true;
    t.get('card', 'shared', 'produkte', []).then(function (produkte) {
      var main = produkte.find(p => p.id === mainId);
      if (!main) return;
      var sub = (main.unterartikel || []).find(s => s.id === subId);
      if (!sub) return;
      sub.status = neuerStatus;
      return persistProdukte(t, t.getContext().card, produkte);
    }).then(function () {
      isSaving = false;
      zeichnen();
    }).catch(function (e) {
      isSaving = false;
      handleError(e);
    });
  }

  function loeschen(id) {
    if (letzterHauptartikelId === id) letzterHauptartikelId = null;
    t.get('card', 'shared', 'produkte', []).then(function (produkte) {
      var gefiltert = produkte.filter(p => p.id !== id);
      return persistProdukte(t, t.getContext().card, gefiltert);
    }).then(zeichnen).catch(handleError);
  }

  function loeschenSub(mainId, subId) {
    t.get('card', 'shared', 'produkte', []).then(function (produkte) {
      var main = produkte.find(p => p.id === mainId);
      if (main && main.unterartikel) {
        main.unterartikel = main.unterartikel.filter(s => s.id !== subId);
      }
      return persistProdukte(t, t.getContext().card, produkte);
    }).then(zeichnen).catch(handleError);
  }

  function editItem(type, mainId, subId = null) {
    t.get('card', 'shared', 'produkte', []).then(function(produkte) {
      var main = produkte.find(item => item.id === mainId);
      if (!main) return;

      if (type === 'haupt') {
        letzterHauptartikelId = mainId;
        editId = main.id;
        document.getElementById('stk').value = main.stk || '1';
        document.getElementById('artikel').value = main.produkt || '';
        document.getElementById('preis').value = (main.preis || '').replace(',', '.');
        document.getElementById('speichern').textContent = 'Speichern';
        openOverlay('haupt');
      } else if (type === 'sub') {
        var s = (main.unterartikel || []).find(x => x.id === subId);
        if (!s) return;
        currentMainIdForSub = mainId;
        editSubId = s.id;
        document.getElementById('sub-stk').value = s.stk || '1';
        document.getElementById('sub-art').value = s.produkt || '';
        document.getElementById('sub-preis').value = (s.preis || '').replace(',', '.');
        document.getElementById('sub-lieferant').value = s.lieferant || '';
        document.getElementById('sub-status').value = s.status || 'bestellen';
        document.getElementById('btn-sub-speichern').textContent = 'Speichern';
        openOverlay('sub', mainId);
      }
    }).catch(handleError);
  }

  function zeichnen() {
    if (isSaving) return;
    t.get('card', 'shared', 'produkte', []).then(produkte => {
      const el = document.getElementById('inhalt');

      if (!produkte.length) {
        el.innerHTML = '<div class="leer">Noch keine Artikel vorhanden.</div>';
        t.sizeTo(document.body);
        return;
      }

      if (!letzterHauptartikelId && produkte.length > 0) {
        letzterHauptartikelId = produkte[produkte.length - 1].id;
      }

      let gesamtCents = 0;
      const fragment = document.createDocumentFragment();
      const wrapper = document.createElement('div');
      wrapper.className = 'tabellen-rahmen';

      let html = `<table>
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

      produkte.forEach((p, i) => {
        const stk = parseInt(p.stk, 10) || 0;
        const preisCents = parsePreisToCents(p.preis);
        const zwischensummeCents = stk * preisCents;
        const subs = p.unterartikel || [];

        let subSummeCents = 0;
        if (subs && subs.length > 0) {
          subs.forEach(sub => {
            subSummeCents += (parseInt(sub.stk, 10) || 0) * parsePreisToCents(sub.preis);
          });
        }
        const subSummeHtml = subSummeCents > 0 ? `<br><span class="text-light" style="font-size: 11px;">+ ${formatEuro(subSummeCents / 100)} Extras</span>` : '';
        const liefHtml = p.lieferant ? `<br><span class="lief-text">${escapeHtml(getLieferantName(p.lieferant, lieferantenEinstellungen))}</span>` : '';

        html += `<tr>
          <td><button class="expand-btn" data-action="toggleSub" data-idx="${i}" id="btn-${i}">${subs.length > 0 ? '−' : '+'}</button></td>
          <td class="zahl">${stk}</td>
          <td><strong>${escapeHtml(p.produkt)}</strong>${liefHtml}</td>
          <td class="zahl"><span class="preis-pill">${formatEuro(preisCents / 100)}</span></td>
          <td class="zahl">${formatEuro(zwischensummeCents / 100)}${subSummeHtml}</td>
          <td class="zahl">
            <div class="action-icons">
              <span class="icon-btn" data-action="editHaupt" data-id="${escapeHtmlAttr(p.id)}" title="Bearbeiten">Bearbeiten</span>
              <span class="icon-btn-delete" data-action="loeschen" data-id="${escapeHtmlAttr(p.id)}" title="Löschen">Löschen</span>
            </div>
          </td>
        </tr>`;

        html += `<tr><td colspan="6" class="no-pad-border">
                <div id="sub-${i}" class="sub-container" style="display:${subs.length > 0 ? 'block' : 'none'};">`;

        if (subs.length > 0) {
          html += `<table class="sub-table tabellen-rahmen"><tbody>`;
          subs.forEach(sub => {
            const subStk = parseInt(sub.stk, 10) || 0;
            const subPreisCents = parsePreisToCents(sub.preis);
            const subLiefHtml = sub.lieferant ? `<br><span class="sub-lief-text">${escapeHtml(getLieferantName(sub.lieferant, lieferantenEinstellungen))}</span>` : '';

            let rowClass = '';
            if (sub.status === 'bestellen') rowClass = 'row-bestellen';
            else if (sub.status === 'zulauf') rowClass = 'row-zulauf';
            else if (sub.status === 'vorhanden') rowClass = 'row-vorhanden';

            html += `<tr class="${rowClass}">
               <td class="zahl w-40">${subStk}x</td>
               <td>↳ ${escapeHtml(sub.produkt)}${subLiefHtml}</td>
               <td class="zahl">${formatEuro(subPreisCents / 100)}</td>
               <td class="ws-nowrap">
                 <select class="status-select" data-action="updateStatus" data-main="${escapeHtmlAttr(p.id)}" data-sub="${escapeHtmlAttr(sub.id)}">
                   <option value="bestellen" ${sub.status === 'bestellen' ? 'selected' : ''}>Bestellen</option>
                   <option value="zulauf" ${sub.status === 'zulauf' ? 'selected' : ''}>Zulauf</option>
                   <option value="vorhanden" ${sub.status === 'vorhanden' ? 'selected' : ''}>Vorhanden</option>
                 </select>
               </td>
               <td class="zahl">
                  <div class="action-icons">
                    <span class="icon-btn" data-action="editSub" data-main="${escapeHtmlAttr(p.id)}" data-sub="${escapeHtmlAttr(sub.id)}" title="Bearbeiten">Bearbeiten</span>
                    <span class="icon-btn-delete" data-action="loeschenSub" data-main="${escapeHtmlAttr(p.id)}" data-sub="${escapeHtmlAttr(sub.id)}" title="Löschen">Löschen</span>
                  </div>
               </td>
             </tr>`;
          });
          html += `</tbody></table>`;
        }
        gesamtCents += zwischensummeCents;

        const hint = (p.id === letzterHauptartikelId) ? ' [ n ]' : '';
        html += `<button class="btn-hinzufuegen btn-small mt-5" data-action="openSubOverlay" data-id="${escapeHtmlAttr(p.id)}">+ Unterartikel hinzufügen${hint}</button>`;
        html += `</div></td></tr>`;
      });

      html += `</tbody>
        <tfoot>
          <tr>
            <td colspan="4"></td>
            <td class="zahl">Gesamt</td>
            <td class="zahl">${formatEuro(gesamtCents / 100)}</td>
          </tr>
        </tfoot>
      </table>`;

      wrapper.innerHTML = html;
      fragment.appendChild(wrapper);
      el.replaceChildren(fragment);
      t.sizeTo(document.body);
    });
  }

  // Event Delegation for table actions
  document.getElementById('inhalt').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    
    var action = btn.dataset.action;
    var mainId = btn.dataset.id || btn.dataset.main;
    var subId = btn.dataset.sub;
    var idx = btn.dataset.idx;

    if (action === 'toggleSub') toggleSub(idx);
    else if (action === 'editHaupt') editItem('haupt', mainId);
    else if (action === 'loeschen') loeschen(mainId);
    else if (action === 'editSub') editItem('sub', mainId, subId);
    else if (action === 'loeschenSub') loeschenSub(mainId, subId);
    else if (action === 'openSubOverlay') openOverlay('sub', mainId);
  });

  document.getElementById('inhalt').addEventListener('change', function(e) {
    var select = e.target;
    if (select.dataset.action === 'updateStatus') {
      updateRadio(select.dataset.main, select.dataset.sub, select.value);
    }
  });

  function attachAutoFill(inputId, preisId, liefId) {
    var inputEl = document.getElementById(inputId);
    var liefEl = document.getElementById(liefId); // might be null
    if (!inputEl) return;
    inputEl.addEventListener('input', function () {
      var val = inputEl.value.trim();
      var found = katalogObjekte.find(k => k.name === val);
      if (found) {
        if (found.preis && !document.getElementById(preisId).value) {
          document.getElementById(preisId).value = String(found.preis).replace(',', '.');
        }
        if (liefEl && found.lieferant && !liefEl.value) {
          liefEl.value = found.lieferant;
        }
      }
    });
  }

  attachAutoFill('artikel', 'preis');
  attachAutoFill('sub-art', 'sub-preis', 'sub-lieferant');

  var btnOpenHaupt = document.getElementById('btn-open-haupt');
  if (btnOpenHaupt) {
    btnOpenHaupt.addEventListener('click', function() {
      openOverlay('haupt');
    });
  }

  document.querySelectorAll('.btn-close-overlay').forEach(function(btn) {
    btn.addEventListener('click', closeOverlays);
  });

  ['stk', 'artikel', 'preis'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('speichern').click();
        }
      });
    }
  });

  ['sub-stk', 'sub-art', 'sub-preis', 'sub-lieferant'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('btn-sub-speichern').click();
        }
      });
    }
  });

  document.getElementById('sub-status').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-sub-speichern').click();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    
    if (e.key === 'Escape') {
      closeOverlays();
      return;
    }
    
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (e.key === '+') {
      e.preventDefault();
      openOverlay('haupt');
    }

    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      if (letzterHauptartikelId) {
        openOverlay('sub', letzterHauptartikelId);
      } else {
        t.get('card', 'shared', 'produkte', []).then(function(produkte) {
          if (produkte.length > 0) {
            letzterHauptartikelId = produkte[produkte.length - 1].id;
            openOverlay('sub', letzterHauptartikelId);
          } else {
             if(typeof showToast !== 'undefined') showToast("Kein Hauptartikel zum Hinzufügen von Unterartikeln vorhanden.", true);
          }
        });
      }
    }
  });

  t.render(function () {
    var context = t.getContext();
    if (context && context.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    
    window.focus();
    if (document.activeElement === document.body) {
      document.body.focus();
    }

    zeichnen();
  });
})();
