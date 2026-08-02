/* global TrelloPowerUp */

var GRAY_ICON = CONFIG.BASE_URL + 'icon-gray.svg';

TrelloPowerUp.initialize({

  'board-buttons': function (t) {
    return [{
      icon: { light: GRAY_ICON, dark: GRAY_ICON },
      text: 'Auswertung',
      callback: function (t) {
        return t.popup({
          title: 'Auswertung',
          url: './menu.html',
          height: 110
        });
      }
    }];
  },

  'card-badges': function (t) {
    return t.get('card', 'shared', 'produkte', []).then(function (produkte) {
      return produkte.map(function (p) {
        var stk = parseFloat(p.stk) || 0;
        var preis = parseFloat(p.preis) || 0;
        return { text: stk + 'x ' + p.produkt + ' – ' + preis.toFixed(2).replace('.', ',') + '€' };
      });
    });
  },

  'card-back-section': function (t) {
    return {
      title: 'Bestellte Artikel',
      icon: GRAY_ICON,
      content: {
        type: 'iframe',
        url: t.signUrl('./table.html'),
                         height: 250 // Die Höhe passt sich durch t.sizeTo() in der HTML automatisch an
      }
    };
  },

  'show-settings': function (t, options) {
    return t.popup({
      title: 'Einstellungen',
      url: './settings.html',
      height: 350
    });
  },

  'authorization-status': function(t, options) {
    return t.getRestApi().isAuthorized().then(function(isAuthorized) {
      return { authorized: isAuthorized };
    });
  },

  'show-authorization': function(t, options) {
    return t.popup({
      title: 'Trello Autorisierung',
      url: './auth.html',
      height: 140
    });
  }

}, {
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});
