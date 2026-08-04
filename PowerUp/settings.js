/* global TrelloPowerUp, CONFIG, escapeHtml */
var t = TrelloPowerUp.iframe({
  appKey: typeof CONFIG !== 'undefined' ? CONFIG.TRELLO_APP_KEY : (typeof APP_KEY !== 'undefined' ? APP_KEY : '')
});

var globalLabels = [];

function renderLieferanten(lieferanten) {
  var container = document.getElementById('lieferanten-container');
  container.innerHTML = '';

  var optionsHtml = '<option value="">- Kein Label ausgewählt -</option>';
  globalLabels.forEach(function(l) {
    var displayName = escapeHtml(l.name ? l.name : ('(Ohne Name) - ' + l.color));
    optionsHtml += '<option value="' + escapeHtmlAttr(l.id) + '">' + displayName + '</option>';
  });

  lieferanten.forEach(function(lief, index) {
    var div = document.createElement('div');
    div.className = 'form-group';
    div.dataset.liefId = lief.id;
    div.style.marginBottom = '15px';
    div.style.padding = '10px';
    div.style.border = '1px solid var(--border)';
    div.style.borderRadius = 'var(--radius)';
    div.style.position = 'relative';

    div.innerHTML = `
      <button class="remove-btn" type="button" style="position:absolute; top:5px; right:5px; width:24px; height:24px; padding:0; background:transparent; color:var(--text-light); border:none; cursor:pointer;" data-index="${index}">✕</button>
      <label>Lieferant Name</label>
      <input type="text" class="lief-name-input" value="${escapeHtmlAttr(lief.name || '')}" placeholder="z.B. Volmary" style="margin-bottom:8px;">
      <label>Trello-Label</label>
      <select class="lief-label-select color-select">
        ${optionsHtml}
      </select>
    `;
    
    // Set selected value after innerHTML
    div.querySelector('.lief-label-select').value = lief.labelId || '';
    
    // Handle remove button
    div.querySelector('.remove-btn').addEventListener('click', function() {
      lieferanten.splice(index, 1);
      renderLieferanten(lieferanten);
      t.sizeTo(document.body);
    });

    container.appendChild(div);
  });
  t.sizeTo(document.body);
}

var currentLieferanten = [];

t.render(function() {
  var context = t.getContext();
  if (context && context.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');

  Promise.all([
    t.board('labels'),
    t.get('board', 'shared', 'lieferanten'),
    t.get('board', 'shared', 'statusLabels')
  ]).then(function(res) {
    globalLabels = res[0].labels || [];
    
    currentLieferanten = normalizeLieferantenEinstellungen(res[1]);

    if (currentLieferanten.length === 0) {
      currentLieferanten.push({ id: 'lief_' + Date.now(), name: '', labelId: '' }); // default empty
    }

    renderLieferanten(currentLieferanten);

    var statusLabels = res[2] || {};
    var selectEl = document.getElementById('alles-bestellt-label');
    var optionsHtml = '<option value="">- Kein Label ausgewählt -</option>';
    globalLabels.forEach(function(l) {
      var displayName = escapeHtml(l.name ? l.name : ('(Ohne Name) - ' + l.color));
      optionsHtml += '<option value="' + escapeHtmlAttr(l.id) + '">' + displayName + '</option>';
    });
    selectEl.innerHTML = optionsHtml;
    selectEl.value = statusLabels.allesBestellt || '';

  });
});

document.getElementById('add-lief-btn').addEventListener('click', function() {
  currentLieferanten.push({ id: 'lief_' + Date.now(), name: '', labelId: '' });
  renderLieferanten(currentLieferanten);
});

document.getElementById('save-btn').addEventListener('click', function() {
  var container = document.getElementById('lieferanten-container');
  var newLieferanten = [];
  
  var groups = container.querySelectorAll('.form-group');
  groups.forEach(function(group, idx) {
    var originalId = group.dataset.liefId || ('lief_' + Date.now() + '_' + idx);
    newLieferanten.push({
      id: originalId,
      name: group.querySelector('.lief-name-input').value.trim(),
      labelId: group.querySelector('.lief-label-select').value
    });
  });

  var statusLabels = {
    allesBestellt: document.getElementById('alles-bestellt-label').value
  };

  Promise.all([
    t.set('board', 'shared', 'lieferanten', newLieferanten),
    t.set('board', 'shared', 'statusLabels', statusLabels)
  ]).then(function() {
    var msg = document.getElementById('success-msg');
    msg.style.display = 'block';
    setTimeout(function() {
      t.closePopup();
    }, 1000);
  });
});
