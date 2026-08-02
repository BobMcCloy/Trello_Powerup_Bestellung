// utils.js

var STANDARD_KATALOG = [
  { name: 'Steckschaum', preis: '', lieferant: '' },
  { name: 'Blumendraht', preis: '', lieferant: '' },
  { name: 'Klebeband', preis: '', lieferant: '' },
  { name: 'Vase (Glas)', preis: '', lieferant: '' },
  { name: 'Vase (Keramik)', preis: '', lieferant: '' },
  { name: 'Schleifenband rot', preis: '', lieferant: '' },
  { name: 'Schleifenband weiß', preis: '', lieferant: '' },
  { name: 'Rose Rot', preis: '', lieferant: '' },
  { name: 'Rose Weiß', preis: '', lieferant: '' },
  { name: 'Rose Gelb', preis: '', lieferant: '' }
];

function formatEuro(n) { 
  var val = parseFloat(n) || 0;
  return val.toFixed(2).replace('.', ',') + ' €'; 
}

function escapeHtml(str) { 
  if (str === null || str === undefined) return '';
  var div = document.createElement('div'); 
  div.textContent = String(str); 
  return div.innerHTML; 
}

function syncCardLabels(t, cardId, produkte, lieferantenSettings) {
  if (!lieferantenSettings) return Promise.resolve();

  var hasLief1 = false;
  var hasLief2 = false;

  produkte.forEach(function(p) {
    if (p.lieferant === 'lief1' && (!p.unterartikel || p.unterartikel.length === 0)) hasLief1 = true;
    if (p.lieferant === 'lief2' && (!p.unterartikel || p.unterartikel.length === 0)) hasLief2 = true;
    
    (p.unterartikel || []).forEach(function(sub) {
      if (sub.status === 'bestellen' || sub.status === 'zulauf') {
        var effLief = sub.lieferant || p.lieferant;
        if (effLief === 'lief1') hasLief1 = true;
        if (effLief === 'lief2') hasLief2 = true;
      }
    });
  });

  return t.getRestApi().getToken().then(function(token) {
    if (!token) return Promise.resolve(); // Keine Erlaubnis oder nicht autorisiert
    
    var appKey = typeof CONFIG !== 'undefined' ? CONFIG.TRELLO_APP_KEY : (typeof APP_KEY !== 'undefined' ? APP_KEY : '');
    
    return fetch('https://api.trello.com/1/cards/' + cardId + '?key=' + appKey + '&token=' + token)
    .then(function(res) {
      if (!res.ok) throw new Error('API Request failed');
      return res.json();
    })
    .then(function(card) {
       var activeLabelIds = card.idLabels || [];

       var applyLabelLogic = function(liefKey, shouldHave) {
          var labelId = lieferantenSettings[liefKey] ? lieferantenSettings[liefKey].labelId : null;
          if (!labelId) return Promise.resolve();

          var hasLabel = activeLabelIds.includes(labelId);
          if (shouldHave && !hasLabel) {
             return fetch('https://api.trello.com/1/cards/' + cardId + '/idLabels?value=' + labelId + '&key=' + appKey + '&token=' + token, { method: 'POST' });
          } else if (!shouldHave && hasLabel) {
             return fetch('https://api.trello.com/1/cards/' + cardId + '/idLabels/' + labelId + '?key=' + appKey + '&token=' + token, { method: 'DELETE' });
          }
          return Promise.resolve();
       };

       return applyLabelLogic('lief1', hasLief1).then(function() {
         return applyLabelLogic('lief2', hasLief2);
       });
    }).catch(function(err) {
      console.error('Fehler beim Synchronisieren der Labels:', err);
    });
  });
}
