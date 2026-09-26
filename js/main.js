const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqMobile = matchMedia('(max-width: 860px)');
const EMAIL = 'hashandharmapriya@gmail.com';

// ── Liquid glass refraction: backdrop-filter:url() only renders in Chromium ──
if (navigator.userAgentData && CSS.supports('backdrop-filter', 'url(#lg-refract) blur(1px)')) {
  document.documentElement.classList.add('lg-refract');
}

// ── Clocks + year ──
function updateClocks() {
  const now = new Date();
  const hm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const bar = document.getElementById('menubar-time');
  if (bar) bar.textContent = `${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}  ${hm}`;
}
updateClocks();
setInterval(updateClocks, 15000);
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

// ── Scroll reveal (one-shot) ──
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el) => revealObs.observe(el));

// ── Active-section tracking: a thin band across the middle of the viewport ──
function trackSections(ids, root, onActive) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) onActive(e.target.id); });
  }, { root, rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
  return obs;
}

const dtabs = document.querySelectorAll('.tabs .tab');
const dTabMap = { home: 0, 'd-about': 0, 'd-skills': 0, 'd-experience': 1, 'd-projects': 2, 'd-education': 2, 'd-contact': 3 };
trackSections(Object.keys(dTabMap), null, (id) => {
  dtabs.forEach((t, i) => t.classList.toggle('active', i === dTabMap[id]));
});

// ── Mobile tab bar (iOS-style liquid glass) ──
const tabbar = document.querySelector('.tabbar');
const lgBar = tabbar.querySelector('.lg-bar');
const mTabs = [...tabbar.querySelectorAll('.m-tab')];
const mTabMap = { 'm-home': 'home', 'm-about': 'home', 'm-skills': 'stack', 'm-experience': 'work', 'm-projects': 'code', 'm-education': 'code', 'm-contact': 'contact' };
let activeTab = 'home';

// Glass lens slides under the active tab; a short horizontal stretch sells the "liquid" move.
function placeLens(animate) {
  const tab = lgBar.querySelector(`.m-tab[data-tab="${activeTab}"]`);
  if (!tab) return; // contact lives in the separate button; CSS hides the lens
  lgBar.style.setProperty('--lens-w', `${tab.offsetWidth}px`);
  lgBar.style.setProperty('--lens-x', `${tab.offsetLeft - 5}px`);
  if (animate && !reducedMotion) {
    lgBar.querySelector('.lg-lens i').animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.18) scaleY(0.92)', offset: 0.35 }, { transform: 'scaleX(1)' }],
      { duration: 480, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }
}
function setMTab(name) {
  if (name === activeTab) return;
  activeTab = name;
  tabbar.dataset.active = name;
  mTabs.forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
  });
  placeLens(true);
}
tabbar.dataset.active = activeTab;
placeLens(false);
new ResizeObserver(() => placeLens(false)).observe(lgBar);
let lockUntil = 0; // ignore scroll-spy while a tapped tab's smooth scroll is in flight
mTabs.forEach((t) => t.addEventListener('click', () => { lockUntil = performance.now() + 900; setMTab(t.dataset.tab); }));
// press: the lens swells slightly, like iOS glass under a finger
lgBar.addEventListener('pointerdown', () => lgBar.classList.add('pressing'));
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => lgBar.addEventListener(ev, () => lgBar.classList.remove('pressing')));

let lastY = 0, ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) > 6 && mqMobile.matches) { tabbar.classList.toggle('compact', dy > 0 && y > 160); lastY = y; }
    ticking = false;
  });
}
trackSections(Object.keys(mTabMap), null, (id) => { if (performance.now() > lockUntil) setMTab(mTabMap[id]); });
window.addEventListener('scroll', onScroll, { passive: true });

// ── Experience tabs (WAI-ARIA tabs pattern) ──
const expTabs = [...document.querySelectorAll('.exp-nav-item')];
function selectExp(tab, focus) {
  expTabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.getAttribute('aria-controls'));
    if (panel.hidden === !on) return;
    panel.hidden = !on;
    if (on) {
      // blur masks the crossfade so it reads as one change rather than two states
      panel.animate(
        reducedMotion
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
    }
  });
  if (focus) tab.focus();
}
expTabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectExp(tab));
  tab.addEventListener('keydown', (e) => {
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); selectExp(expTabs[(i + k + expTabs.length) % expTabs.length], true); }
    else if (e.key === 'Home') { e.preventDefault(); selectExp(expTabs[0], true); }
    else if (e.key === 'End') { e.preventDefault(); selectExp(expTabs[expTabs.length - 1], true); }
  });
});

// ── Spotlight borders: pointer position written to the element itself ──
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.spot').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// ── Toast + copy email ──
const toast = document.getElementById('toast');
let toastTimer = 0;
function showToast(html) {
  toast.innerHTML = html;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
document.querySelectorAll('[data-copy-email]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      showToast(`Copied <b>${EMAIL}</b>`);
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  });
});

// ── Terminal typing ──
const phrases = ['npx react-native run-android', 'cd ios && pod install', './gradlew bundleRelease', 'git push origin main'];
const typingEl = document.getElementById('typing-line-d');
if (typingEl && reducedMotion) {
  typingEl.textContent = phrases[0];
} else if (typingEl) {
  let pi = 0, ci = 0, deleting = false;
  const type = () => {
    const phrase = phrases[pi];
    typingEl.textContent = phrase.slice(0, deleting ? ci-- : ci++);
    if (!deleting && ci > phrase.length) { deleting = true; return setTimeout(type, 1400); }
    if (deleting && ci < 0) { deleting = false; pi = (pi + 1) % phrases.length; ci = 0; return setTimeout(type, 400); }
    setTimeout(type, deleting ? 35 : 60);
  };
  setTimeout(type, 1200);
}

// ── Hero WebGL (lazy: after load + idle, only for the visible layout) ──
let disposeScene = null;
let mountToken = 0;
async function mountScene() {
  const token = ++mountToken;
  disposeScene?.();
  disposeScene = null;
  const mobile = mqMobile.matches;
  const host = document.querySelector(`.scene-host[data-scene="${mobile ? 'mobile' : 'desktop'}"]`);
  if (!host) return;
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) return; // CSS gradient fallback stays
  try {
    const { mountLiquidScene } = await import('./liquid-scene.js');
    const dispose = await mountLiquidScene({
      host,
      markEl: mobile ? null : document.querySelector('.hero-mark'),
      reducedMotion,
    });
    if (token !== mountToken) dispose(); // layout changed while loading
    else disposeScene = dispose;
  } catch (err) {
    console.warn('[hero] WebGL scene unavailable, using CSS fallback', err);
  }
}
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
const boot = () => idle(mountScene, { timeout: 1500 });
if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });
mqMobile.addEventListener('change', mountScene);
