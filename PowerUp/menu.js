var t = TrelloPowerUp.iframe();

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

t.render(function () {
  var context = t.getContext();
  if (context && context.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
});
