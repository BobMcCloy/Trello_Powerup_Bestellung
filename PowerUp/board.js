// Initialisierung mit Schlüsseln aus der config.js
var POWERUP_ID = CONFIG.POWERUP_ID;
var APP_KEY = CONFIG.TRELLO_APP_KEY;
var t = TrelloPowerUp.iframe({ appKey: APP_KEY, appName: 'Blumenladen Produktliste' });

var trelloToken = '';
var alleKarten = [];
var letzteAuswertung = { summen: {}, gesamtStk: 0, gesamtUmsatz: 0, anzahlKarten: 0 };
var unterartikelKatalog = [];
var viewMode = 'auswertung';
var lieferantenEinstellungen = null;
var letzteManagerItems = [];

function getLieferantName(liefKey) {
  if (!liefKey) return '';
  var found = lieferantenEinstellungen.find(l => l.id === liefKey);
  if (found) return found.name;
  return liefKey;
}

// ==========================================
// Filter-Persistenz Logik
// ==========================================

function speichereFilterZustand() {
  try {
    var zustand = {
      liste: document.getElementById('filter-liste').value,
      ohneDatum: document.getElementById('ohne-datum').checked,
      status: document.getElementById('filter-status').value,
      suche: document.getElementById('filter-suche').value,
      lieferant: document.getElementById('filter-lieferant').value,
      optGroupCard: document.getElementById('opt-group-card').checked,
      optGroupParent: document.getElementById('opt-group-parent').checked,
      optGroupArticle: document.getElementById('opt-group-article').checked,
      viewMode: viewMode
    };
    sessionStorage.setItem('blumenladen_filter_zustand', JSON.stringify(zustand));
  } catch (error) {
    console.warn('sessionStorage blockiert (Cross-Origin):', error);
  }
}

function stelleFilterZustandWiederHer() {
  // Immer das aktuelle Datum als Startdatum setzen
  var heute = new Date();
  document.getElementById('filter-datum-von').value = heute.toISOString().slice(0, 10);

  try {
    var gespeicherterText = sessionStorage.getItem('blumenladen_filter_zustand');
    if (gespeicherterText) {
      try {
        var z = JSON.parse(gespeicherterText);
        if (z.ohneDatum !== undefined) document.getElementById('ohne-datum').checked = z.ohneDatum;
        if (z.status !== undefined) document.getElementById('filter-status').value = z.status;
        if (z.lieferant !== undefined) document.getElementById('filter-lieferant').value = z.lieferant;
        if (z.suche !== undefined) document.getElementById('filter-suche').value = z.suche;
        if (z.optGroupCard !== undefined) document.getElementById('opt-group-card').checked = z.optGroupCard;
        if (z.optGroupParent !== undefined) document.getElementById('opt-group-parent').checked = z.optGroupParent;
        if (z.optGroupArticle !== undefined) document.getElementById('opt-group-article').checked = z.optGroupArticle;

        if (z.viewMode) {
          viewMode = z.viewMode;
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelector(`.tab-btn[data-tab="${viewMode}"]`).classList.add('active');
          document.getElementById('csv-export').style.display = viewMode === 'auswertung' ? 'inline-block' : 'none';
          document.getElementById('text-export').style.display = viewMode === 'manager' ? 'inline-block' : 'none';
        }
        return z.liste;
      } catch (error) {
        console.error(error);
      }
    }
  } catch (error) {
    console.warn('sessionStorage blockiert (Cross-Origin):', error);
  }
  return 'all';
}

// ==========================================
// Status-Update Logik via Iframe-API
// ==========================================

var inFlightRequests = new Set();

window.updateBestellStatus = function (btn, cardId, mainId, subId, neuerStatus) {
  if (inFlightRequests.has(cardId)) {
    return; // Block concurrent requests for the same card
  }

  inFlightRequests.add(cardId);
  var alterText = btn.innerHTML;
  btn.innerHTML = '⏳...';

  // Disable all action buttons for this card
  var cardButtons = document.querySelectorAll(`button[data-card-id="${cardId}"]`);
  cardButtons.forEach(b => b.disabled = true);

  t.get(cardId, 'shared', 'produkte', []).then(function (produkte) {
    var mainIdx = produkte.findIndex(p => p.id === mainId);
    if (mainIdx !== -1 && produkte[mainIdx].unterartikel) {
      var subIdx = produkte[mainIdx].unterartikel.findIndex(s => s.id === subId);
      if (subIdx !== -1) {
        produkte[mainIdx].unterartikel[subIdx].status = neuerStatus;
      }
    }
    return t.set(cardId, 'shared', 'produkte', produkte).then(function () {
      return produkte;
    });
  }).then(function (produkte) {
    var card = alleKarten.find(c => c.id === cardId);
    if (card) {
      if (!card.pluginData) card.pluginData = [];
      var pd = card.pluginData.find(p => p.idPlugin === POWERUP_ID);
      var wert = { produkte: produkte };
      if (pd) {
        pd.value = JSON.stringify(wert);
      } else {
        card.pluginData.push({ idPlugin: POWERUP_ID, value: JSON.stringify(wert) });
      }
    }
    wendeFilterAn();
    syncCardLabels(t, cardId, produkte);
  }).catch(function (err) {
    console.error('Fehler beim Speichern:', err);
    btn.innerHTML = 'Fehler';
    setTimeout(function () {
      btn.innerHTML = alterText;
      btn.disabled = false;
    }, 3000);
  }).finally(function () {
    inFlightRequests.delete(cardId);
    var cardButtons = document.querySelectorAll(`button[data-card-id="${cardId}"]`);
    cardButtons.forEach(b => {
      // Only re-enable if it's not the clicked button (which might be handled differently, though here we just re-enable all)
      b.disabled = false;
      if (b === btn && b.innerHTML === '⏳...') {
        b.innerHTML = alterText;
      }
    });
  });
};

window.updateMehrereBestellStatus = function (btn, sourceJson, neuerStatus) {
  var sources;
  try {
    sources = JSON.parse(decodeURIComponent(sourceJson));
  } catch (e) {
    console.error("Fehler beim Parsen der Quellen:", e);
    return;
  }

  if (sources.length === 0) return;

  var alterText = btn.innerHTML;
  btn.innerHTML = '⏳...';
  btn.disabled = true;

  var byCard = {};
  sources.forEach(function (src) {
    if (!byCard[src.cardId]) byCard[src.cardId] = [];
    byCard[src.cardId].push(src);
  });

  var cardIds = Object.keys(byCard);
  var promises = cardIds.map(function (cardId) {
    if (inFlightRequests.has(cardId)) {
      return Promise.resolve();
    }
    inFlightRequests.add(cardId);

    return t.get(cardId, 'shared', 'produkte', []).then(function (produkte) {
      var changed = false;
      byCard[cardId].forEach(function (src) {
        var mainIdx = produkte.findIndex(p => p.id === src.mainId);
        if (mainIdx !== -1 && produkte[mainIdx].unterartikel) {
          var subIdx = produkte[mainIdx].unterartikel.findIndex(s => s.id === src.subId);
          if (subIdx !== -1) {
            produkte[mainIdx].unterartikel[subIdx].status = neuerStatus;
            changed = true;
          }
        }
      });
      if (changed) {
        return t.set(cardId, 'shared', 'produkte', produkte).then(function () {
          return produkte;
        });
      }
      return null;
    }).then(function (produkte) {
      if (produkte) {
        var card = alleKarten.find(c => c.id === cardId);
        if (card) {
          if (!card.pluginData) card.pluginData = [];
          var pd = card.pluginData.find(p => p.idPlugin === POWERUP_ID);
          var wert = { produkte: produkte };
          if (pd) {
            pd.value = JSON.stringify(wert);
          } else {
            card.pluginData.push({ idPlugin: POWERUP_ID, value: JSON.stringify(wert) });
          }
        }
        syncCardLabels(t, cardId, produkte);
      }
    }).catch(function (err) {
      console.error('Fehler bei Karte ' + cardId + ':', err);
    }).finally(function () {
      inFlightRequests.delete(cardId);
    });
  });

  Promise.all(promises).then(function () {
    wendeFilterAn();
  });
};

t.get('board', 'shared', 'katalog', STANDARD_KATALOG).then(function (gespeichert) {
  unterartikelKatalog = gespeichert;
  var datalist = document.getElementById('katalog-liste');
  unterartikelKatalog.forEach(function (kat) {
    var opt = document.createElement('option');
    opt.value = typeof kat === 'string' ? kat : kat.name;
    datalist.appendChild(opt);
  });
});

t.get('board', 'shared', 'lieferanten').then(function (data) {
  var rawLief = data;
  lieferantenEinstellungen = [];
  if (rawLief && typeof rawLief === 'object' && !Array.isArray(rawLief)) {
    if (rawLief.lief1 && rawLief.lief1.name) lieferantenEinstellungen.push({ id: 'lief1', name: rawLief.lief1.name });
    if (rawLief.lief2 && rawLief.lief2.name) lieferantenEinstellungen.push({ id: 'lief2', name: rawLief.lief2.name });
  } else if (Array.isArray(rawLief)) {
    lieferantenEinstellungen = rawLief;
  }

  var select = document.getElementById('filter-lieferant');
  lieferantenEinstellungen.forEach(function (lief) {
    if (lief.name) {
      var opt = document.createElement('option');
      opt.value = escapeHtml(lief.id);
      opt.textContent = lief.name;
      select.appendChild(opt);
    }
  });
});

// utils.js enthält nun formatEuro und escapeHtml

window.switchTab = function (tabName) {
  viewMode = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById('csv-export').style.display = tabName === 'auswertung' ? 'inline-block' : 'none';
  document.getElementById('text-export').style.display = tabName === 'manager' ? 'inline-block' : 'none';

  var sf = document.getElementById('filter-status');
  if (tabName === 'manager') {
    sf.disabled = true;
    sf.title = 'Status-Filter ist im Manager-Modus deaktiviert.';
  } else {
    sf.disabled = false;
    sf.title = '';
  }

  wendeFilterAn();
};

function ladeAuswertung() {
  var restApi = t.getRestApi();
  document.getElementById('status').textContent = 'Lade Karten & Listen...';

  Promise.all([restApi.getToken(), t.board('id'), t.lists('all')]).then(function (res) {
    trelloToken = res[0];
    var boardId = res[1].id, listen = res[2];

    var gemerkteListe = stelleFilterZustandWiederHer();

    var listenSelect = document.getElementById('filter-liste');
    listenSelect.innerHTML = '<option value="all">Alle Listen</option>';
    listen.forEach(function (liste) {
      var opt = document.createElement('option'); opt.value = liste.id; opt.textContent = liste.name;
      listenSelect.appendChild(opt);
    });

    if (gemerkteListe) {
      listenSelect.value = gemerkteListe;
    }

    var url = 'https://api.trello.com/1/boards/' + boardId + '/cards?pluginData=true&fields=name,idList,due&key=' + APP_KEY + '&token=' + trelloToken;
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('API-Fehler'); return r.json(); });
  }).then(function (cards) {
    alleKarten = cards;
    wendeFilterAn();
  }).catch(function (err) {
    document.getElementById('status').innerHTML = '<span class="fehler">Fehler beim Laden der API.</span>';
  });
}

function getMapEntry(map, key, defaultObj) {
  if (!map[key]) map[key] = defaultObj;
  return map[key];
}

function wendeFilterAn() {
  speichereFilterZustand();

  var listenFilter = document.getElementById('filter-liste').value;
  var datumVon = document.getElementById('filter-datum-von').value;
  var datumBis = document.getElementById('filter-datum-bis').value;
  var statusFilter = document.getElementById('filter-status').value;
  if (viewMode === 'manager') {
    statusFilter = 'all'; // Im Manager-Modus greift der Status-Filter nicht
  }
  var suchFilter = document.getElementById('filter-suche').value.toLowerCase();
  var lieferantFilter = document.getElementById('filter-lieferant').value;
  var ohneDatumEinschliessen = document.getElementById('ohne-datum').checked;

  var groupByCard = document.getElementById('opt-group-card').checked;
  var groupByParent = document.getElementById('opt-group-parent').checked;

  var gefilterteKarten = alleKarten.filter(function (card) {
    if (listenFilter !== 'all' && card.idList !== listenFilter) return false;
    if (!card.due) return ohneDatumEinschliessen;
    if (datumVon || datumBis) {
      var f = new Date(card.due); f.setHours(0, 0, 0, 0);
      if (datumVon && f < new Date(datumVon)) return false;
      if (datumBis && f > new Date(datumBis)) return false;
    }
    return true;
  });

  var summen = {};
  var managerItems = [];

  gefilterteKarten.forEach(function (card) {
    (card.pluginData || []).forEach(function (pd) {
      if (pd.idPlugin !== POWERUP_ID) return;
      var wert; try { wert = JSON.parse(pd.value); } catch (e) { return; }
      var produkte = wert.produkte;
      if (typeof produkte === 'string') { try { produkte = JSON.parse(produkte); } catch (e) { produkte = []; } }
      if (!Array.isArray(produkte)) return;

      var cardKey = groupByCard ? card.name : 'Alle Bestellungen';

      produkte.forEach(function (p) {
        var hauptName = p.produkt || '';
        var hauptLiefMatch = (lieferantFilter === 'all') || (lieferantFilter === 'none' && !p.lieferant) || (p.lieferant === lieferantFilter);
        var hauptMatch = hauptName.toLowerCase().includes(suchFilter) && hauptLiefMatch;
        var subs = p.unterartikel || [];

        var valideSubs = subs.filter(function (sub) {
          var subName = sub.produkt || '';
          var textMatch = subName.toLowerCase().includes(suchFilter);
          var statusMatch = (statusFilter === 'all') || (sub.status === statusFilter);
          var effectiveLief = sub.lieferant || p.lieferant || '';
          var subLiefMatch = (lieferantFilter === 'all') || (lieferantFilter === 'none' && !effectiveLief) || (effectiveLief === lieferantFilter);
          return textMatch && statusMatch && subLiefMatch;
        });

        if (viewMode === 'manager') {
          valideSubs.forEach(function (sub) {
            if (sub.status === 'bestellen' || sub.status === 'zulauf') {
              managerItems.push({
                card: card, mainId: p.id, mainName: hauptName, sub: sub,
                lieferant: sub.lieferant || p.lieferant || ''
              });
            }
          });
          return;
        }

        if ((hauptMatch && statusFilter === 'all') || valideSubs.length > 0) {
          var cMap = getMapEntry(summen, cardKey, { name: cardKey, items: {} });
          var hKey = hauptName + '␟' + parseFloat(p.preis || 0).toFixed(2);
          var hEntry;

          if (groupByParent) {
            hEntry = getMapEntry(cMap.items, hKey, { name: hauptName, preis: parseFloat(p.preis || 0), stk: 0, umsatz: 0, subs: {} });
            hEntry.stk += parseFloat(p.stk || 0);
            hEntry.umsatz += parseFloat(p.stk || 0) * parseFloat(p.preis || 0);

            valideSubs.forEach(function (sub) {
              var sKey = sub.produkt + '␟' + parseFloat(sub.preis || 0).toFixed(2);
              var sEntry = getMapEntry(hEntry.subs, sKey, { name: sub.produkt, preis: parseFloat(sub.preis || 0), stk: 0, umsatz: 0 });
              sEntry.stk += parseFloat(sub.stk || 0);
              sEntry.umsatz = 0; // Unterartikel zählen nicht zum Umsatz
            });
          } else {
            if (hauptMatch && statusFilter === 'all') {
              hEntry = getMapEntry(cMap.items, hKey, { name: hauptName, preis: parseFloat(p.preis || 0), stk: 0, umsatz: 0 });
              hEntry.stk += parseFloat(p.stk || 0);
              hEntry.umsatz += parseFloat(p.stk || 0) * parseFloat(p.preis || 0);
            }
            valideSubs.forEach(function (sub) {
              var sKey = '↳ ' + sub.produkt + '␟' + parseFloat(sub.preis || 0).toFixed(2);
              var sEntry = getMapEntry(cMap.items, sKey, { name: sub.produkt, preis: parseFloat(sub.preis || 0), stk: 0, umsatz: 0 });
              sEntry.stk += parseFloat(sub.stk || 0);
              sEntry.umsatz = 0; // Unterartikel zählen nicht zum Umsatz
            });
          }
        }
      });
    });
  });

  if (viewMode === 'manager') {
    var optGroupArticle = document.getElementById('opt-group-article').checked;
    var finalManagerItems = managerItems;

    if (optGroupArticle) {
      var groupMap = {};
      managerItems.forEach(function (item) {
        var key = item.sub.produkt.trim().toLowerCase() + '␟' + (item.lieferant || '').trim().toLowerCase() + '␟' + item.sub.status;
        if (!groupMap[key]) {
          groupMap[key] = {
            card: { name: '(Mehrere)' },
            mainName: '(Mehrere)',
            lieferant: item.lieferant,
            sub: { produkt: item.sub.produkt, status: item.sub.status, stk: 0 },
            isGrouped: true,
            sourceItems: []
          };
        }
        groupMap[key].sub.stk += parseFloat(item.sub.stk) || 0;
        groupMap[key].sourceItems.push({ cardId: item.card.id, mainId: item.mainId, subId: item.sub.id });
      });
      finalManagerItems = Object.values(groupMap);
      groupByCard = false;
      groupByParent = false;
    }

    zeichneManager(finalManagerItems, groupByCard, groupByParent, gefilterteKarten.length);
  } else {
    zeichneAuswertung(summen, groupByCard, groupByParent, gefilterteKarten.length);
  }
}

function zeichneAuswertung(summen, groupByCard, groupByParent, anzahlKarten) {
  var tabelle = document.getElementById('tabelle');
  var status = document.getElementById('status');
  var cKeys = Object.keys(summen).sort((a, b) => a.localeCompare(b, 'de'));

  if (cKeys.length === 0) {
    status.textContent = anzahlKarten + ' Karten durchsucht, aber keine Artikel für diese Filter gefunden.';
    tabelle.innerHTML = '';
    letzteAuswertung = { summen: {}, gesamtStk: 0, gesamtUmsatz: 0, anzahlKarten: anzahlKarten };
    t.sizeTo(document.body);
    return;
  }

  var globalStk = 0, globalUmsatz = 0;
  var html = `<div class="tabellen-rahmen">
    <table>
      <thead>
        <tr>
          <th>Artikel</th>
          <th class="zahl">Stk</th>
          <th class="zahl">Einzelpreis</th>
        </tr>
      </thead>
      <tbody>`;

  cKeys.forEach(function (ck) {
    var cMap = summen[ck];

    if (groupByCard) {
      html += `<tr class="group-header card-header"><td colspan="3">${escapeHtml(cMap.name)}</td></tr>`;
    }

    var hKeys = Object.keys(cMap.items).sort((a, b) => cMap.items[a].name.localeCompare(cMap.items[b].name, 'de'));
    hKeys.forEach(function (hk) {
      var hEntry = cMap.items[hk];
      globalStk += hEntry.stk; globalUmsatz += hEntry.umsatz;

      var hNameClass = (groupByParent && Object.keys(hEntry.subs || {}).length > 0) ? 'font-bold ' : '';
      var hIndentClass = groupByCard ? 'pl-20 ' : '';

      html += `<tr class="auswertung-row">
        <td class="${hIndentClass}${hNameClass}">${groupByParent ? '↳ ' : ''}${escapeHtml(hEntry.name)}</td>
        <td class="zahl">${hEntry.stk}</td>
        <td class="zahl"><span class="umsatz-pill">${formatEuro(hEntry.preis)}</span></td>
      </tr>`;

      if (hEntry.subs) {
        var sKeys = Object.keys(hEntry.subs).sort((a, b) => hEntry.subs[a].name.localeCompare(hEntry.subs[b].name, 'de'));
        sKeys.forEach(function (sk) {
          var sEntry = hEntry.subs[sk];
          globalStk += sEntry.stk; globalUmsatz += sEntry.umsatz;

          var sIndentClass = (groupByCard && groupByParent) ? 'pl-40 ' : ((groupByCard || groupByParent) ? 'pl-20 ' : '');

          html += `<tr>
            <td class="${sIndentClass}text-light">${groupByParent ? '↳ ' : ''}${escapeHtml(sEntry.name)}</td>
            <td class="zahl">${sEntry.stk}</td>
            <td class="zahl"><span class="umsatz-pill">${formatEuro(sEntry.preis)}</span></td>
          </tr>`;
        });
      }
    });
  });

  status.textContent = anzahlKarten + ' passende Karten verarbeitet.';
  html += `</tbody>
    <tfoot>
      <tr>
        <td>Gesamt</td>
        <td class="zahl">${globalStk}</td>
        <td class="zahl">Umsatz: ${formatEuro(globalUmsatz)}</td>
      </tr>
    </tfoot>
  </table></div>`;
  tabelle.innerHTML = html;

  letzteAuswertung = { summen: summen, gesamtStk: globalStk, gesamtUmsatz: globalUmsatz, anzahlKarten: anzahlKarten, byCard: groupByCard, byParent: groupByParent };
  aktualisiereDruckKopf();
  t.sizeTo(document.body);
}

function zeichneManager(items, groupByCard, groupByParent, anzahlKarten) {
  var status = document.getElementById('status');
  status.textContent = anzahlKarten + ' Karten nach offenen Bestellungen durchsucht.';

  if (items.length === 0) {
    document.getElementById('tabelle').innerHTML = '<div class="tabellen-rahmen"><table><tr><td class="leer">Keine offenen Bestellungen für diese Filter. Alles erledigt!</td></tr></table></div>';
    t.sizeTo(document.body);
    return;
  }

  items.sort((a, b) => {
    if (groupByCard) {
      var c = a.card.name.localeCompare(b.card.name, 'de');
      if (c !== 0) return c;
    }
    if (groupByParent) {
      var m = a.mainName.localeCompare(b.mainName, 'de');
      if (m !== 0) return m;
    }
    return a.sub.produkt.localeCompare(b.sub.produkt, 'de');
  });

  var columns = [];
  if (!groupByCard) columns.push('Karte');
  if (!groupByParent) columns.push('Hauptartikel');
  columns.push('Lieferant', 'Unterartikel', 'Stk', 'Status', 'Aktion');

  var html = `<div class="tabellen-rahmen"><table><thead><tr>`;
  columns.forEach(c => {
    html += `<th${c === 'Stk' ? ' class="zahl"' : ''}>${escapeHtml(c)}</th>`;
  });
  html += `</tr></thead><tbody>`;

  var currentCardId = null;
  var currentMainName = null;

  items.forEach(function (item) {
    if (groupByCard && currentCardId !== item.card.id) {
      currentCardId = item.card.id;
      currentMainName = null;
      html += `<tr class="group-header card-header"><td colspan="${columns.length}">${escapeHtml(item.card.name)}</td></tr>`;
    }

    if (groupByParent && currentMainName !== item.mainName) {
      currentMainName = item.mainName;
      var headerdentClass = groupByCard ? 'pl-20 ' : '';
      html += `<tr class="group-header main-header"><td colspan="${columns.length}" class="${headerdentClass}">${escapeHtml(item.mainName)}</td></tr>`;
    }

    var badgeClass = item.sub.status === 'zulauf' ? 'status-pill zulauf' : 'status-pill bestellen';
    var statusText = item.sub.status === 'zulauf' ? 'Im Zulauf' : 'Zu bestellen';

    var subdentClass = (groupByCard && groupByParent) ? 'pl-40 ' : ((groupByCard || groupByParent) ? 'pl-20 ' : '');
    var parentClass = groupByParent ? 'text-light ' : '';

    html += `<tr>`;
    if (!groupByCard) html += `<td>${escapeHtml(item.card.name)}</td>`;
    if (!groupByParent) html += `<td>${escapeHtml(item.mainName)}</td>`;

    html += `<td class="text-light">${escapeHtml(getLieferantName(item.lieferant))}</td>`;
    html += `<td class="${subdentClass}${parentClass}">${groupByParent ? '↳ ' : ''}${escapeHtml(item.sub.produkt)}</td>`;
    html += `<td class="zahl"><strong>${item.sub.stk}x</strong></td>`;
    html += `<td><span class="${badgeClass}">${statusText}</span></td>`;
    html += `<td class="action-icons">`;
    if (item.isGrouped) {
      var sourceJson = encodeURIComponent(JSON.stringify(item.sourceItems));
      if (item.sub.status === 'bestellen') {
        html += `<button class="action-btn btn-zulauf" onclick="updateMehrereBestellStatus(this, '${sourceJson}', 'zulauf')">Zulauf</button>`;
      }
      if (item.sub.status === 'zulauf') {
        html += `<button class="action-btn btn-vorhanden" onclick="updateMehrereBestellStatus(this, '${sourceJson}', 'vorhanden')">Vorhanden</button>`;
      }
    } else {
      if (item.sub.status === 'bestellen') {
        html += `<button class="action-btn btn-zulauf" onclick="updateBestellStatus(this, '${item.card.id}', '${item.mainId}', '${item.sub.id}', 'zulauf')">Zulauf</button>`;
      }
      if (item.sub.status === 'zulauf') {
        html += `<button class="action-btn btn-vorhanden" onclick="updateBestellStatus(this, '${item.card.id}', '${item.mainId}', '${item.sub.id}', 'vorhanden')">Vorhanden</button>`;
      }
      html += `<button class="action-btn" onclick="zurKarteSpringen('${item.card.id}')">Karte öffnen</button>`;
    }
    html += `</td></tr>`;
  });

  html += '</tbody></table></div>';
  document.getElementById('tabelle').innerHTML = html;

  letzteManagerItems = items;
  t.sizeTo(document.body);
}

window.zurKarteSpringen = function (cardId) {
  speichereFilterZustand();
  t.showCard(cardId);
};

function aktualisiereDruckKopf() {
  var listenText = document.getElementById('filter-liste').selectedOptions[0].textContent;
  var von = document.getElementById('filter-datum-von').value;
  var bis = document.getElementById('filter-datum-bis').value;
  var zeitraum = (von || bis) ? (von || '…') + ' bis ' + (bis || '…') : 'alle';
  var jetzt = new Date().toLocaleDateString('de-DE');

  document.getElementById('druck-kopf').textContent =
    'Erstellt am ' + jetzt + ' · Liste: ' + listenText + ' · Zeitraum: ' + zeitraum +
    ' · ' + letzteAuswertung.anzahlKarten + ' Karten durchsucht';
}

function csvFeld(wert) {
  wert = String(wert);
  if (/^[=+\-@]/.test(wert)) {
    wert = "'" + wert;
  }
  if (/[;"\n]/.test(wert)) { return '"' + wert.replace(/"/g, '""') + '"'; }
  return wert;
}

function exportCsv() {
  if (!letzteAuswertung.summen || Object.keys(letzteAuswertung.summen).length === 0) return;

  var zeilen = ['Kategorie/Karte;Artikel;Stk gesamt;Einzelpreis (EUR);Zeilenumsatz (EUR)'];

  var cKeys = Object.keys(letzteAuswertung.summen).sort((a, b) => a.localeCompare(b, 'de'));
  cKeys.forEach(function (ck) {
    var cMap = letzteAuswertung.summen[ck];
    var cardLabel = letzteAuswertung.byCard ? ck : 'Alle Karten';

    var hKeys = Object.keys(cMap.items).sort((a, b) => cMap.items[a].name.localeCompare(cMap.items[b].name, 'de'));
    hKeys.forEach(function (hk) {
      var hEntry = cMap.items[hk];
      zeilen.push(csvFeld(cardLabel) + ';' + csvFeld(hEntry.name) + ';' + hEntry.stk + ';' + hEntry.preis.toFixed(2).replace('.', ',') + ';' + hEntry.umsatz.toFixed(2).replace('.', ','));

      if (hEntry.subs) {
        var sKeys = Object.keys(hEntry.subs).sort((a, b) => hEntry.subs[a].name.localeCompare(hEntry.subs[b].name, 'de'));
        sKeys.forEach(function (sk) {
          var sEntry = hEntry.subs[sk];
          zeilen.push(csvFeld(cardLabel) + ';' + csvFeld('↳ ' + sEntry.name) + ';' + sEntry.stk + ';' + sEntry.preis.toFixed(2).replace('.', ',') + ';' + sEntry.umsatz.toFixed(2).replace('.', ','));
        });
      }
    });
  });

  zeilen.push('Gesamt;;' + letzteAuswertung.gesamtStk + ';;' + letzteAuswertung.gesamtUmsatz.toFixed(2).replace('.', ','));

  var csvInhalt = zeilen.join('\r\n');
  var blob = new Blob(['\uFEFF' + csvInhalt], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var datum = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'bestell-auswertung_' + datum + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('filter-liste').addEventListener('change', wendeFilterAn);
document.getElementById('filter-datum-von').addEventListener('input', wendeFilterAn);
document.getElementById('filter-datum-bis').addEventListener('input', wendeFilterAn);
document.getElementById('filter-status').addEventListener('change', wendeFilterAn);
document.getElementById('filter-lieferant').addEventListener('change', wendeFilterAn);

var debounceTimer;
document.getElementById('filter-suche').addEventListener('input', function () {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(wendeFilterAn, 250);
});
document.getElementById('ohne-datum').addEventListener('change', wendeFilterAn);
document.getElementById('opt-group-card').addEventListener('change', wendeFilterAn);
document.getElementById('opt-group-parent').addEventListener('change', wendeFilterAn);
document.getElementById('opt-group-article').addEventListener('change', wendeFilterAn);

document.getElementById('autorisieren').addEventListener('click', function () {
  t.getRestApi().authorize({ scope: 'read,write' }).then(function () {
    document.getElementById('auth-bereich').style.display = 'none'; document.getElementById('ergebnis').style.display = 'block'; ladeAuswertung();
  });
});

document.getElementById('neuladen').addEventListener('click', ladeAuswertung);
document.getElementById('csv-export').addEventListener('click', exportCsv);
document.getElementById('pdf-export').addEventListener('click', function () { window.print(); });

function generateTextExport() {
  if (!letzteManagerItems || letzteManagerItems.length === 0) {
    alert("Keine Bestell-Artikel zum Kopieren vorhanden.");
    return;
  }

  var groupedByLieferant = {};

  letzteManagerItems.forEach(function (item) {
    var lname = item.lieferant ? getLieferantName(item.lieferant) : "Unbekannt";
    if (!groupedByLieferant[lname]) {
      groupedByLieferant[lname] = [];
    }
    groupedByLieferant[lname].push(item);
  });

  var text = "BESTELL-LISTE\n";
  text += "========================================\n\n";

  var lieferantenNamen = Object.keys(groupedByLieferant).sort();

  lieferantenNamen.forEach(function (lname) {
    text += lname + ":\n";
    text += "    " + "Stk.:".padEnd(8, " ") + "Artikel:".padEnd(35, " ") + "Einzelpreis:\n";

    groupedByLieferant[lname].forEach(function (item) {
      var preisNum = parseFloat(item.sub.preis) || 0;
      var preisStr = preisNum.toFixed(2).replace('.', ',') + " €";

      var artText = item.sub.produkt;

      var stkPad = (item.sub.stk + "x").padEnd(8, " ");
      var artPad = artText.padEnd(35, " ");

      text += "    - " + stkPad + artPad + preisStr + "\n";
    });

    text += "\n";
  });

  document.getElementById('text-export-area').value = text;
  document.getElementById('overlay-text-export').style.display = 'flex';
}

document.getElementById('text-export').addEventListener('click', generateTextExport);

t.render(function () {
  var context = t.getContext();
  if (context && context.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  t.getRestApi().isAuthorized().then(function (auth) {
    if (auth) {
      document.getElementById('auth-bereich').style.display = 'none';
      document.getElementById('ergebnis').style.display = 'block';
      ladeAuswertung();
    }
  });
});
