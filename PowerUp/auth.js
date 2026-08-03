/* global TrelloPowerUp, CONFIG */
var t = TrelloPowerUp.iframe({
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});

document.getElementById('auth-btn').addEventListener('click', function () {
  t.getRestApi()
    .authorize({ scope: 'read,write', expiration: 'never' })
    .then(function () {
      return t.closePopup();
    })
    .catch(TrelloPowerUp.restApiError.AuthDeniedError, function () {
      console.log('Autorisierung abgebrochen.');
    })
    .catch(function (e) {
      console.error('Allgemeiner Auth Fehler:', e);
      alert('Es gab einen Fehler bei der Autorisierung: ' + e.message);
    });
});
