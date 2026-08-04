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

window.handleError = function(err) {
  console.error('Fehler:', err);
  alert('Es ist ein Fehler aufgetreten: ' + err.message);
};

function syncCardLabels(t, cardId, produkte) {
  return Promise.all([
    t.get('board', 'shared', 'lieferanten'),
    t.get('board', 'shared', 'statusLabels')
  ]).then(function(res) {
    var data = res[0];
    var statusLabels = res[1] || {};

    var lieferanten = [];
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Legacy Migration
      if (data.lief1 && data.lief1.labelId) lieferanten.push({ id: 'lief1', labelId: data.lief1.labelId });
      if (data.lief2 && data.lief2.labelId) lieferanten.push({ id: 'lief2', labelId: data.lief2.labelId });
    } else if (Array.isArray(data)) {
      lieferanten = data;
    }
    

    var activeLieferanten = new Set();
    var hasBestellen = false;
    var hasZulauf = false;

    produkte.forEach(function(p) {
      // Nur Unterartikel, die auf 'bestellen' stehen, aktivieren das Lieferanten-Label
      (p.unterartikel || []).forEach(function(sub) {
        if (sub.status === 'bestellen') hasBestellen = true;
        if (sub.status === 'zulauf') hasZulauf = true;

        if (sub.status === 'bestellen') {
          activeLieferanten.add(sub.lieferant || p.lieferant);
        }
      });
    });

    var shouldHaveAllesBestellt = (!hasBestellen && hasZulauf);
    return t.getRestApi().getToken().then(function(token) {
      if (!token) return Promise.resolve();
      
      var appKey = typeof CONFIG !== 'undefined' ? CONFIG.TRELLO_APP_KEY : (typeof APP_KEY !== 'undefined' ? APP_KEY : '');
      
      return fetch('https://api.trello.com/1/cards/' + cardId + '?fields=idLabels&key=' + appKey + '&token=' + token)
      .then(function(res) {
        if (!res.ok) throw new Error('API Request failed (card labels)');
        return res.json();
      })
      .then(function(cardData) {
         var activeLabelIds = cardData.idLabels || [];
         var desiredLabelIds = activeLabelIds.slice();

         lieferanten.forEach(function(lief) {
            var labelId = lief.labelId;
            if (!labelId) return;

            var shouldHave = activeLieferanten.has(lief.id);
            var index = desiredLabelIds.indexOf(labelId);
            
            if (shouldHave && index === -1) {
               desiredLabelIds.push(labelId);
            } else if (!shouldHave && index !== -1) {
               desiredLabelIds.splice(index, 1);
            }
         });

         if (statusLabels.allesBestellt) {
           var labelId = statusLabels.allesBestellt;
           var index = desiredLabelIds.indexOf(labelId);
           if (shouldHaveAllesBestellt && index === -1) {
             desiredLabelIds.push(labelId);
           } else if (!shouldHaveAllesBestellt && index !== -1) {
             desiredLabelIds.splice(index, 1);
           }
         }

         var changed = desiredLabelIds.length !== activeLabelIds.length || !desiredLabelIds.every(function(id) {
           return activeLabelIds.includes(id);
         });

         if (changed) {
            return fetch('https://api.trello.com/1/cards/' + cardId + '?key=' + appKey + '&token=' + token, {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ idLabels: desiredLabelIds.join(',') })
            });
         }
         return Promise.resolve();
      }).catch(function(err) {
        console.error('Fehler beim Synchronisieren der Labels:', err);
      });
    });
  });
}
