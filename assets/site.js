/** Small things every page does: platform hints, the language menu and the language suggestion. */

const cfg = JSON.parse(document.getElementById('site-config')?.textContent ?? '{}');

// Put the matching store first.
if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add('is-android');

// Close the language menu when tapping elsewhere.
document.addEventListener('click', (e) => {
  for (const menu of document.querySelectorAll('.lang-menu[open]')) if (!menu.contains(e.target)) menu.open = false;
});

// Offer the visitor's own language when this page is in another one. No automatic redirects:
// search engines and people sharing links should always get the page they asked for.
const DISMISSED = 'bjj-site/lang-suggest-dismissed';
const bar = document.querySelector('.lang-suggest');

function siteLanguage(tag) {
  const t = String(tag).toLowerCase();
  if (t.startsWith('pt')) return 'pt-BR';
  if (t.startsWith('es')) return 'es';
  if (t.startsWith('ja')) return 'ja';
  if (t.startsWith('en')) return 'en';
  return null;
}

if (bar && cfg.langs) {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED) === '1';
  } catch {}
  const preferred = (navigator.languages?.length ? navigator.languages : [navigator.language]).map(siteLanguage).find(Boolean);
  const target = cfg.langs.find((l) => l.code === preferred);
  if (!dismissed && target && target.code !== cfg.lang) {
    bar.lang = target.code;
    bar.querySelector('p').textContent = target.suggest.text;
    const link = bar.querySelector('a');
    link.textContent = target.suggest.action;
    link.href = target.href + location.search;
    link.hreflang = target.code;
    bar.querySelector('button').setAttribute('aria-label', target.suggest.close);
    bar.hidden = false;
  }
  bar.querySelector('button').addEventListener('click', () => {
    bar.hidden = true;
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {}
  });
}
