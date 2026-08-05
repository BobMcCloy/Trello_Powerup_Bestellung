/* global TrelloPowerUp, CONFIG */
const t = TrelloPowerUp.iframe({
  appKey: CONFIG.TRELLO_APP_KEY,
  appName: 'Blumenladen Produktliste'
});

document.getElementById('btn-auswertung').addEventListener('click', function () {
  t.modal({
    title: 'Produkt-Auswertung',
    url: './board.html',
    height: 600,
    fullscreen: false
  });
});

document.getElementById('btn-katalog').addEventListener('click', function () {
  t.modal({
    title: 'Katalog verwalten',
    url: './katalog.html',
    height: 500,
    fullscreen: false
  });
});

t.render(() => {
  const context = t.getContext();
  if (context && context.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
});
