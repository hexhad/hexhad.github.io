// Apps catalog (apps/index.html): theme toggle, filters, search and deep links.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

// ── Appearance (initial value set pre-paint in <head>) ──
function savedTheme() {
  try { const t = localStorage.getItem('theme'); return t === 'light' || t === 'dark' ? t : null; } catch { return null; }
}
function applyTheme(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f4f5f6' : '#0a0b0d';
  const next = theme === 'light' ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', `Switch to ${next} appearance`));
}
function switchTheme(theme) {
  if (document.startViewTransition && !reducedMotion) document.startViewTransition(() => applyTheme(theme));
  else applyTheme(theme);
}
applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', theme); } catch { /* private mode */ }
    switchTheme(theme);
  });
});
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => { if (!savedTheme()) switchTheme(e.matches ? 'light' : 'dark'); });
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

// ── Phone tab bar pill sits under "Apps" ──
const tabbar = document.querySelector('.tabbar');
function movePill() {
  const on = tabbar?.querySelector('a[aria-current="true"]');
  if (!tabbar || !on) return;
  tabbar.style.setProperty('--pill-o', '1');
  tabbar.style.setProperty('--pill-l', `${on.offsetLeft}px`);
  tabbar.style.setProperty('--pill-r', `${tabbar.clientWidth - (on.offsetLeft + on.offsetWidth)}px`);
}
movePill();
addEventListener('resize', movePill, { passive: true });

// ── Spotlight that follows the pointer ──
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.spot').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// ── Filters + search ──
const cards = [...document.querySelectorAll('.app')];
const buttons = [...document.querySelectorAll('[data-filter]')];
const input = document.querySelector('[data-search-input]');
const empty = document.querySelector('[data-empty]');
const emptyText = document.querySelector('[data-empty-text]');
const FILTERS = new Set(buttons.map((b) => b.dataset.filter));
const tagsOf = (card) => card.dataset.tags.split(' ');

let filter = 'all';
let query = '';

function render({ syncUrl = true } = {}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const card of cards) {
    const ok = (filter === 'all' || tagsOf(card).includes(filter)) && words.every((w) => card.dataset.search.includes(w));
    card.hidden = !ok;
    if (ok) card.style.setProperty('--i', String(Math.min(shown++, 8)));
  }
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  empty.hidden = shown > 0;
  if (!shown) emptyText.textContent = query ? `No apps match “${query}”.` : 'Nothing here yet.';
  if (syncUrl) {
    const url = new URL(location.href);
    if (filter === 'all') url.searchParams.delete('show'); else url.searchParams.set('show', filter);
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }
}

buttons.forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
input.addEventListener('input', () => { query = input.value.trim(); render(); });
document.querySelector('[data-reset]').addEventListener('click', () => {
  filter = 'all'; query = ''; input.value = ''; render(); input.focus();
});

// restore ?show= and ?q= so a filtered view can be shared
const params = new URLSearchParams(location.search);
if (FILTERS.has(params.get('show'))) filter = params.get('show');
if (params.get('q')) { query = params.get('q'); input.value = query; }
render({ syncUrl: false });

// ── Deep link (#p-name): make sure the card is visible, then point at it ──
function focusHash() {
  const card = location.hash.startsWith('#p-') && document.getElementById(location.hash.slice(1));
  if (!card || !card.classList.contains('app')) return;
  if (card.hidden) { filter = 'all'; query = ''; input.value = ''; render(); }
  card.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
}
addEventListener('hashchange', focusHash);
if (location.hash) requestAnimationFrame(focusHash);
