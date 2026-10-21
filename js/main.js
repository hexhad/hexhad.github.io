const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
let disposeScene = null; // hero WebGL teardown (+ setTheme), set once the scene mounts
let morse = null; // liquid Morse hero visual (+ setTheme, replay)
let contactSetTheme = null; // recolors the contact section's liquid mark

// ── Liquid glass refraction: backdrop-filter:url() only renders in Chromium ──
if (navigator.userAgentData && CSS.supports('backdrop-filter', 'url(#lg-refract) blur(1px)')) {
  root.classList.add('lg-refract');
}

// ── Appearance: dark / light toggle (initial value set pre-paint in <head>) ──
const mqLight = matchMedia('(prefers-color-scheme: light)');
function savedTheme() {
  try { const t = localStorage.getItem('theme'); return t === 'light' || t === 'dark' ? t : null; } catch { return null; }
}
function applyTheme(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f4f5f6' : '#0a0b0d';
  const next = theme === 'light' ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', `Switch to ${next} appearance`));
  disposeScene?.setTheme?.(theme);
  morse?.setTheme(theme);
  contactSetTheme?.(theme);
}
function switchTheme(theme) {
  // cross-fade instead of an abrupt brightness jump
  if (document.startViewTransition && !reducedMotion) document.startViewTransition(() => applyTheme(theme));
  else applyTheme(theme);
}
applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', theme); } catch { /* private mode: still switch for this visit */ }
    switchTheme(theme);
  });
});
// follow the system until the visitor picks one explicitly
mqLight.addEventListener('change', (e) => { if (!savedTheme()) switchTheme(e.matches ? 'light' : 'dark'); });

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

// ── Scroll reveal ──
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
document.querySelectorAll('.reveal').forEach((el) => revealIO.observe(el));

// ── Active section in the nav and the phone tab bar ──
const navLinks = [...document.querySelectorAll('.nav-links a, .tabbar a')];
const sections = [...new Set(navLinks.map((a) => a.getAttribute('href')))].map((h) => document.querySelector(h)).filter(Boolean);
const tabbar = document.querySelector('.tabbar');
// the tab bar's pill slides under whichever link is current
function movePill() {
  const on = tabbar?.querySelector('a[aria-current="true"]');
  if (!tabbar) return;
  tabbar.style.setProperty('--pill-o', on ? '1' : '0');
  if (!on) return;
  tabbar.style.setProperty('--pill-x', `${on.offsetLeft}px`);
  tabbar.style.setProperty('--pill-w', `${on.offsetWidth}px`);
}
function setCurrent(id) {
  navLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === id)));
  movePill();
}
const sectionIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) setCurrent(`#${e.target.id}`);
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => sectionIO.observe(s));
// clear the highlight while the hero is on screen
new IntersectionObserver(([e]) => { if (e.isIntersecting) setCurrent(null); }, { rootMargin: '-45% 0px -50% 0px' }).observe(document.getElementById('top'));
window.addEventListener('resize', movePill, { passive: true });

// ── Spotlight on product cards: pointer position written to the card itself ──
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.spot').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// ── Scroll: nav hides on the way down, returns on the way up; hero copy drifts out ──
const nav = document.querySelector('.nav');
const hero = document.getElementById('top');
const heroCopy = hero?.querySelector('.hero-grid');
let lastY = scrollY;
let scrollQueued = false;
function onScroll() {
  scrollQueued = false;
  const y = scrollY;
  const dy = y - lastY;
  if (Math.abs(dy) > 6) { nav?.classList.toggle('nav-hidden', dy > 0 && y > 160); lastY = y; }
  if (heroCopy && !reducedMotion) {
    const drift = Math.min(Math.max(y / hero.offsetHeight, 0), 1);
    heroCopy.style.setProperty('--drift', drift.toFixed(3));
  }
}
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });

// ── Magnetic primary buttons: pulled toward a nearby pointer, sprung back on leave ──
if (!reducedMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.magnetic').forEach((btn) => {
    const PULL = 0.28;
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.classList.add('pulling');
      btn.style.setProperty('--mag-x', `${(e.clientX - (r.left + r.width / 2)) * PULL}px`);
      btn.style.setProperty('--mag-y', `${(e.clientY - (r.top + r.height / 2)) * PULL}px`);
    });
    btn.addEventListener('pointerleave', () => {
      btn.classList.remove('pulling');
      btn.style.setProperty('--mag-x', '0px');
      btn.style.setProperty('--mag-y', '0px');
    });
  });
}

// ── Toast + copy buttons (install commands, email) ──
const toast = document.getElementById('toast');
let toastTimer = 0;
function showToast(html) {
  toast.innerHTML = html;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      const toastText = document.createElement('b');
      toastText.textContent = text;
      showToast(`Copied ${toastText.outerHTML}`);
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1800);
    } catch {
      if (text.includes('@') && !text.includes(' ')) window.location.href = `mailto:${text}`;
      else showToast('Copy failed. Select the command to copy it.');
    }
  });
});

// ── Hero: HEXHAD in liquid Morse (lazy, after load + idle) ──
const stage = document.querySelector('.morse-stage');
const canVibrate = 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;
let morseMod = null;
let currentLetter = 0;
function showLetter(i) {
  currentLetter = i;
}
stage?.addEventListener('click', () => {
  const i = morse ? morse.replay() : currentLetter;
  if (canVibrate && morseMod) navigator.vibrate(morseMod.vibration(morseMod.WORD[i]));
});
async function mountMorseScene() {
  if (!stage) return;
  try {
    morseMod = await import('./morse-liquid.js?v=8');
    if (!document.createElement('canvas').getContext('webgl2')) return; // static dots stay
    morse = await morseMod.mountMorse({ host: stage, reducedMotion, theme: root.dataset.theme, onLetter: showLetter });
    morse.setTheme(root.dataset.theme); // theme may have changed mid-load
  } catch (err) {
    console.warn('[hero] liquid Morse unavailable, using the static dots', err);
  }
}

// ── Hero WebGL (lazy: after load + idle) ──
async function mountScene() {
  const host = document.querySelector('.scene-host');
  if (!host) return;
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) return; // CSS gradient + static mark stay
  try {
    const { mountLiquidScene } = await import('./liquid-scene.js?v=9');
    disposeScene = await mountLiquidScene({
      host,
      markEl: null, // the hero shows the product honeycomb; the liquid mark lives in the contact section
      reducedMotion,
      theme: root.dataset.theme,
    });
    disposeScene.setTheme(root.dataset.theme); // theme may have changed mid-load
  } catch (err) {
    console.warn('[hero] WebGL scene unavailable, using CSS fallback', err);
  }
}
// Closing liquid mark above the contact headline: mounted once the section is near the viewport.
async function mountContactMark() {
  const host = document.querySelector('.contact-scene');
  if (!host || !document.createElement('canvas').getContext('webgl2')) return;
  try {
    const { mountLiquidScene } = await import('./liquid-scene.js?v=9');
    const dispose = await mountLiquidScene({
      host, markEl: document.querySelector('.contact-mark'), reducedMotion, theme: root.dataset.theme, gradient: false, markStyle: 'liquid',
    });
    contactSetTheme = dispose.setTheme;
    dispose.setTheme(root.dataset.theme);
  } catch (err) {
    console.warn('[contact] WebGL mark unavailable, using the static logo', err);
  }
}
const contactEl = document.getElementById('contact');
if (contactEl) {
  const nearIO = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { nearIO.disconnect(); mountContactMark(); }
  }, { rootMargin: '400px 0px' });
  nearIO.observe(contactEl);
}

const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
const boot = () => { idle(mountMorseScene, { timeout: 800 }); idle(mountScene, { timeout: 1500 }); };
if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });
