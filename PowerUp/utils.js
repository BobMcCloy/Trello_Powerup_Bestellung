const STANDARD_KATALOG = [
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

function parsePreisToCents(pStr) {
  if (!pStr) return 0;
  let clean = String(pStr).trim();
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else {
    clean = clean.replace(',', '.');
  }
  return Math.round(parseFloat(clean) * 100) || 0;
}

function formatEuro(n) { 
  const val = parseFloat(n) || 0;
  return val.toFixed(2).replace('.', ',') + ' €'; 
}

function escapeHtml(str) { 
  if (str === null || str === undefined) return '';
  const div = document.createElement('div'); 
  div.textContent = String(str); 
  return div.innerHTML; 
}

function escapeHtmlAttr(str) {
  if (str === null || str === undefined) return '';
  return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(message, isError) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '4px';
  toast.style.color = 'white';
  toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  toast.style.backgroundColor = isError ? '#eb5a46' : '#61bd4f'; // Trello red / green
  toast.style.transition = 'opacity 0.3s';
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, 3000);
}

function handleError(err) {
  console.error('Fehler:', err);
  showToast('Es ist ein Fehler aufgetreten.', true);
}

function normalizeLieferantenEinstellungen(data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const lieferanten = [];
    if (data.lief1 && data.lief1.name) lieferanten.push({ id: 'lief1', name: data.lief1.name, labelId: data.lief1.labelId });
    if (data.lief2 && data.lief2.name) lieferanten.push({ id: 'lief2', name: data.lief2.name, labelId: data.lief2.labelId });
    return lieferanten;
  } else if (Array.isArray(data)) {
    return data;
  }
  return [];
}

function getLieferantName(liefKey, settingsArray) {
  if (!liefKey) return 'Kein Lieferant';
  const found = (settingsArray || []).find(l => l.id === liefKey);
  return found ? found.name : liefKey;
}

function getEffectiveLieferant(sub, haupt) {
  return sub.lieferant || haupt.lieferant;
}

function apiFetch(url, options, appKey, token) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers['Authorization'] = 'OAuth oauth_consumer_key="' + appKey + '", oauth_token="' + token + '"';
  
  return fetch(url, options).then(function(res) {
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('RateLimit');
      }
      throw new Error('API Request failed: ' + res.status);
    }
    return res.json();
  });
}

function syncCardLabels(t, cardId, produkte) {
  return Promise.all([
    t.get('board', 'shared', 'lieferanten'),
    t.get('board', 'shared', 'statusLabels')
  ]).then(res => {
    const lieferanten = normalizeLieferantenEinstellungen(res[0]);
    const statusLabels = res[1] || {};

    const activeLieferanten = new Set();
    let hasBestellen = false;
    let hasZulauf = false;

    produkte.forEach(p => {
      (p.unterartikel || []).forEach(sub => {
        if (sub.status === 'bestellen') hasBestellen = true;
        if (sub.status === 'zulauf') hasZulauf = true;
        if (sub.status === 'bestellen') {
          activeLieferanten.add(getEffectiveLieferant(sub, p));
        }
      });
    });

    const shouldHaveAllesBestellt = (!hasBestellen && hasZulauf);
    
    return t.getRestApi().getToken().then(token => {
      if (!token) return Promise.resolve();
      const appKey = typeof CONFIG !== 'undefined' ? CONFIG.TRELLO_APP_KEY : (typeof APP_KEY !== 'undefined' ? APP_KEY : '');
      const cId = encodeURIComponent(cardId);
      
      return apiFetch('https://api.trello.com/1/cards/' + cId + '?fields=idLabels', {}, appKey, token)
      .then(cardData => {
         const activeLabelIds = cardData.idLabels || [];
         const desiredLabelIds = activeLabelIds.slice();

         lieferanten.forEach(lief => {
            const labelId = lief.labelId;
            if (!labelId) return;

            const shouldHave = activeLieferanten.has(lief.id);
            const index = desiredLabelIds.indexOf(labelId);
            
            if (shouldHave && index === -1) {
               desiredLabelIds.push(labelId);
            } else if (!shouldHave && index !== -1) {
               desiredLabelIds.splice(index, 1);
            }
         });

         if (statusLabels.allesBestellt) {
           const labelId = statusLabels.allesBestellt;
           const index = desiredLabelIds.indexOf(labelId);
           if (shouldHaveAllesBestellt && index === -1) {
             desiredLabelIds.push(labelId);
           } else if (!shouldHaveAllesBestellt && index !== -1) {
             desiredLabelIds.splice(index, 1);
           }
         }

         const changed = desiredLabelIds.length !== activeLabelIds.length || !desiredLabelIds.every(id => activeLabelIds.includes(id));

         if (changed) {
            return apiFetch('https://api.trello.com/1/cards/' + cId, {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ idLabels: desiredLabelIds.join(',') })
            }, appKey, token);
         }
         return Promise.resolve();
      }).catch(err => {
        if (err.message === 'RateLimit') {
           console.warn('Trello API Rate Limit erreicht beim Label Sync (ignoriert)');
        } else {
           console.error('Fehler beim Synchronisieren der Labels:', err);
        }
      });
    });
  });
}

function persistProdukte(t, cardId, produkte) {
  return t.set('card', 'shared', 'produkte', produkte).then(function() {
    return syncCardLabels(t, cardId, produkte);
  });
}
