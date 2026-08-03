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
    optionsHtml += '<option value="' + escapeHtml(l.id) + '">' + displayName + '</option>';
  });

  lieferanten.forEach(function(lief, index) {
    var div = document.createElement('div');
    div.className = 'form-group';
    div.style.marginBottom = '15px';
    div.style.padding = '10px';
    div.style.border = '1px solid var(--border)';
    div.style.borderRadius = 'var(--radius)';
    div.style.position = 'relative';

    div.innerHTML = `
      <button class="remove-btn" type="button" style="position:absolute; top:5px; right:5px; width:24px; height:24px; padding:0; background:transparent; color:var(--text-light); border:none; cursor:pointer;" data-index="${index}">✕</button>
      <label>Lieferant ${index + 1} Name</label>
      <input type="text" class="lief-name-input" value="${escapeHtml(lief.name || '')}" placeholder="z.B. Volmary" style="margin-bottom:8px;">
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
    var data = res[1];

    currentLieferanten = [];
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Legacy Migration
      if (data.lief1 && (data.lief1.name || data.lief1.labelId)) currentLieferanten.push({ id: 'lief1', name: data.lief1.name, labelId: data.lief1.labelId });
      if (data.lief2 && (data.lief2.name || data.lief2.labelId)) currentLieferanten.push({ id: 'lief2', name: data.lief2.name, labelId: data.lief2.labelId });
    } else if (Array.isArray(data)) {
      currentLieferanten = data;
    }

    if (currentLieferanten.length === 0) {
      currentLieferanten.push({ id: 'lief_' + Date.now(), name: '', labelId: '' }); // default empty
    }

    renderLieferanten(currentLieferanten);

    var statusLabels = res[2] || {};
    var selectEl = document.getElementById('alles-bestellt-label');
    var optionsHtml = '<option value="">- Kein Label ausgewählt -</option>';
    globalLabels.forEach(function(l) {
      var displayName = escapeHtml(l.name ? l.name : ('(Ohne Name) - ' + l.color));
      optionsHtml += '<option value="' + escapeHtml(l.id) + '">' + displayName + '</option>';
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
    var originalId = currentLieferanten[idx] ? currentLieferanten[idx].id : ('lief_' + Date.now() + '_' + idx);
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
