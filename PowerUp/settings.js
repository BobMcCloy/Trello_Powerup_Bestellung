/* global TrelloPowerUp, CONFIG */
var t = TrelloPowerUp.iframe({
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});

t.render(function() {
  Promise.all([
    t.board('labels'),
    t.get('board', 'shared', 'lieferanten')
  ]).then(function(res) {
    var labels = res[0].labels || [];
    var data = res[1];

    var optionsHtml = '<option value="">- Kein Label ausgewählt -</option>';
    labels.forEach(function(l) {
      var displayName = l.name ? l.name : ('(Ohne Name) - ' + l.color);
      optionsHtml += '<option value="' + l.id + '">' + displayName + '</option>';
    });

    document.getElementById('lief1-labelId').innerHTML = optionsHtml;
    document.getElementById('lief2-labelId').innerHTML = optionsHtml;

    if (data) {
      document.getElementById('lief1-name').value = data.lief1?.name || '';
      document.getElementById('lief1-labelId').value = data.lief1?.labelId || '';
      document.getElementById('lief2-name').value = data.lief2?.name || '';
      document.getElementById('lief2-labelId').value = data.lief2?.labelId || '';
    }
    t.sizeTo(document.body);
  });
});

document.getElementById('save-btn').addEventListener('click', function() {
  var config = {
    lief1: {
      name: document.getElementById('lief1-name').value.trim(),
      labelId: document.getElementById('lief1-labelId').value
    },
    lief2: {
      name: document.getElementById('lief2-name').value.trim(),
      labelId: document.getElementById('lief2-labelId').value
    }
  };

  t.set('board', 'shared', 'lieferanten', config).then(function() {
    var msg = document.getElementById('success-msg');
    msg.style.display = 'block';
    setTimeout(function() {
      t.closePopup();
    }, 1000);
  });
});
