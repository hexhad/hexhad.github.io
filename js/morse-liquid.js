// Hero visual: "HEXHAD" spelled in Morse as drops of water. Each dot and dash is a capsule SDF joined with a
// smooth union, so between letters dots stretch into dashes, split off and get absorbed like water.
// The drops refract a faint dot grid behind them, and each letter plays with ITU timing: a Cell Mint glow
// runs drop to drop, as in the Morse Code app. Loaded lazily from main.js; without WebGL the static
// fallback in the markup stays.

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

export const WORD = 'HEXHAD';
export const PATTERNS = { H: '....', E: '.', X: '-..-', A: '.-', D: '-..' };
const MAX = 4; // longest pattern in WORD

const UNIT = 0.14;           // seconds per Morse unit while the glow plays
const MORPH = 0.8;           // seconds for the water to settle into a new letter before it plays
const HOLD = 0.8;            // pause after a letter has played
const R = 0.09;              // half the drop thickness (world units)
const GAP = 0.2;             // space between drops at rest
const DASH_HALF = 2 * R;     // dash = 3 dot widths, as in ITU timing

// ink: the dot grid and wire; body: the water's own faint colour; edge: where the surface turns away
const PALETTES = {
  dark: { ink: [0.62, 0.66, 0.67], body: [0.06, 0.1, 0.095], edge: [0.0, 0.0, 0.0], hi: [0.96, 0.98, 0.97], tint: [0.26, 0.88, 0.63], shadow: 0.0, clarity: 1.0 },
  light: { ink: [0.18, 0.2, 0.21], body: [0.96, 1.0, 0.99], edge: [0.3, 0.38, 0.37], hi: [1.0, 1.0, 1.0], tint: [0.07, 0.68, 0.45], shadow: 0.12, clarity: 0.4 },
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uEl[${MAX}];   // x, half length, radius, glow
uniform vec2 uLight;
uniform vec3 uInk, uBody, uEdge, uHi, uTint;
uniform float uShadow;
uniform float uClarity;  // how much of the water's own body shows (lower = clearer)
const float VIEW = 3.0;     // world units across the canvas

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float capsule(vec2 p, vec4 e) {
  vec2 q = p - vec2(e.x, 0.0);
  q.x -= clamp(q.x, -e.y, e.y);
  return length(q) - e.z;
}
float field(vec2 p, out float glow) {
  float d = 1e3, wsum = 0.0;
  glow = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    float di = capsule(p, uEl[i]);
    d = smin(d, di, 0.1);
    float w = exp(-max(di, 0.0) * 30.0) * step(0.002, uEl[i].z);
    wsum += w;
    glow += w * uEl[i].w;
  }
  glow /= max(wsum, 1e-4);
  return d;
}

// what sits behind the water: a faint dot grid and the wire the signal runs along (premultiplied rgba)
vec4 surface(vec2 q, float px) {
  vec2 cell = (fract(q / 0.07 + 0.5) - 0.5) * 0.07;
  float fade = smoothstep(1.15, 0.2, length(q * vec2(0.62, 1.5)));
  float dots = smoothstep(0.005 + px, 0.005 - px, length(cell)) * fade * 0.28;
  float wire = (1.0 - smoothstep(0.0, px * 1.5, abs(q.y))) * smoothstep(VIEW * 0.5, VIEW * 0.2, abs(q.x)) * 0.3;
  float a = max(dots, wire);
  return vec4(uInk * a, a);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(VIEW, VIEW / aspect);
  float glow, g2;
  float d = field(p, glow);
  float px = VIEW / uRes.x * 1.3;

  // a flat top with rounded shoulders, so each bar keeps straight edges at rest
  float e = 0.002;
  vec2 grad = vec2(field(p + vec2(e, 0.0), g2) - d, field(p + vec2(0.0, e), g2) - d) / e;
  float inside = clamp(-d / ${R.toFixed(3)}, 0.0, 1.0);
  float height = 1.0 - pow(1.0 - inside, 4.0);
  vec3 n = normalize(vec3(grad * (1.0 - height) * 1.1, max(height, 0.03)));

  // refraction: each drop is a small lens over the grid behind it
  vec4 behind = surface(p - n.xy * 0.04, px);
  float edgeF = 1.0 - smoothstep(0.0, 0.4, inside);
  vec3 rgb = uBody * (0.25 + 0.2 * height) + behind.rgb * 1.6;
  float alpha = (0.25 + 0.2 * height) * uClarity + behind.a;
  rgb = mix(rgb, uEdge, edgeF * 0.55);
  alpha = max(alpha, edgeF * 0.6);

  vec3 L = normalize(vec3(uLight, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float rl = max(dot(reflect(-L, n), V), 0.0);
  float spec = pow(rl, 240.0) * 1.4 + pow(rl, 20.0) * 0.1;
  float fres = pow(1.0 - n.z, 3.0) * 0.5;
  // caustic: light focused through the drop gathers on the side away from the light
  vec2 away = -normalize(uLight);
  float caustic = (1.0 - smoothstep(0.0, 0.5, inside)) * max(0.0, dot(normalize(grad + 1e-5), away)) * step(0.001, inside) * 0.4;
  rgb += uHi * (spec + fres) + uTint * caustic;
  alpha = min(1.0, alpha + spec + fres + caustic);

  // the drop being played glows from inside
  float core = smoothstep(0.2, 1.0, height);
  rgb = mix(rgb, uTint * (0.45 + 0.75 * core) + uHi * spec, glow * 0.85);
  alpha = mix(alpha, 1.0, glow * 0.85);

  float a = smoothstep(px, -px, d);

  // outside the water: the grid, a soft mint halo round a playing drop, and a light shadow below
  vec4 outside = surface(p, px);
  float halo = exp(-max(d, 0.0) * 22.0) * glow * 0.55;
  float gs;
  float ds = field(p + vec2(-0.02, 0.05), gs);
  float shadow = (1.0 - smoothstep(-0.02, 0.08, ds)) * uShadow;
  outside = vec4(outside.rgb + uTint * halo, min(1.0, outside.a + halo + shadow));

  gl_FragColor = vec4(rgb * alpha, alpha) * a + outside * (1.0 - a);
}`;

// ITU on/off schedule for one letter, in seconds from the start of playback
function schedule(pattern) {
  let t = 0;
  return [...pattern].map((c) => {
    const len = (c === '-' ? 3 : 1) * UNIT;
    const slot = { on: t, off: t + len };
    t += len + UNIT;
    return slot;
  });
}
const playLength = (pattern) => schedule(pattern).at(-1).off;

// rest layout of a letter: centre x and half length per drop, centred on 0
function layout(pattern) {
  const widths = [...pattern].map((c) => 2 * R + (c === '-' ? 2 * DASH_HALF : 0));
  const total = widths.reduce((a, b) => a + b, 0) + GAP * (widths.length - 1);
  let x = -total / 2;
  return widths.map((w, i) => {
    const el = { x: x + w / 2, h: pattern[i] === '-' ? DASH_HALF : 0 };
    x += w + GAP;
    return el;
  });
}

/** Vibration pattern (ms) for a letter, for navigator.vibrate. */
export function vibration(letter, unitMs = 90) {
  const out = [];
  [...PATTERNS[letter]].forEach((c, i) => {
    if (i) out.push(unitMs);
    out.push((c === '-' ? 3 : 1) * unitMs);
  });
  return out;
}

/**
 * Mounts the water Morse scene into `host` (a sized element).
 * @param {{ host: HTMLElement, reducedMotion: boolean, theme?: 'dark' | 'light', onLetter?: (index: number) => void }} opts
 * @returns {Promise<{ dispose: () => void, setTheme: (t: string) => void, replay: () => number }>} replay returns the current letter index
 */
export async function mountMorse({ host, reducedMotion, theme = 'dark', onLetter = () => {} }) {
  const THREE = await import(THREE_URL);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'morse-canvas';
  host.appendChild(canvas);

  const v3 = () => new THREE.Vector3();
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uEl: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uLight: { value: new THREE.Vector2(-0.45, 0.6) },
    uInk: { value: v3() }, uBody: { value: v3() }, uEdge: { value: v3() }, uHi: { value: v3() }, uTint: { value: v3() },
    uShadow: { value: 0 },
    uClarity: { value: 1 },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, premultipliedAlpha: true, depthTest: false }),
  );
  scene.add(mesh);

  let running = false;
  function setTheme(name) {
    const pal = PALETTES[name] || PALETTES.dark;
    for (const k of ['ink', 'body', 'edge', 'hi', 'tint']) uniforms[`u${k[0].toUpperCase()}${k.slice(1)}`].value.fromArray(pal[k]);
    uniforms.uShadow.value = pal.shadow;
    uniforms.uClarity.value = pal.clarity;
    if (!running) draw();
  }

  // springy drop state: under-damped so the water overshoots a little and wobbles into place
  const els = Array.from({ length: MAX }, () => ({ x: 0, vx: 0, h: 0, vh: 0, r: 0, vr: 0, glow: 0, tx: 0, th: 0, tr: 0 }));
  const K = 160, C = 14;
  function spring(el, key, target, dt) {
    const v = `v${key}`;
    el[v] += (K * (target - el[key]) - C * el[v]) * dt;
    el[key] += el[v] * dt;
  }

  let letter = 0, letterT = 0, slots = [];
  function setLetter(i, snap = false) {
    letter = i;
    letterT = 0;
    const pattern = PATTERNS[WORD[i]];
    const rest = layout(pattern);
    slots = schedule(pattern);
    els.forEach((el, k) => {
      if (k < rest.length) {
        if (el.tr === 0) { // a new drop buds out of its neighbour
          const from = els[Math.max(0, k - 1)];
          el.x = from.x; el.h = 0; el.r = 0;
        }
        el.tx = rest[k].x; el.th = rest[k].h; el.tr = R;
      } else { // a spare drop is absorbed into the last one in use
        el.tx = rest.at(-1).x + rest.at(-1).h; el.th = 0; el.tr = 0;
      }
      if (snap) { el.x = el.tx; el.h = el.th; el.r = el.tr; el.vx = el.vh = el.vr = 0; }
    });
    onLetter(i);
  }

  function step(dt) {
    letterT += dt;
    const playT = letterT - MORPH;
    els.forEach((el, k) => {
      spring(el, 'x', el.tx, dt);
      spring(el, 'h', el.th, dt);
      spring(el, 'r', el.tr, dt);
      const on = slots[k] && playT >= slots[k].on && playT < slots[k].off;
      el.glow += ((on ? 1 : 0) - el.glow) * Math.min(1, dt * (on ? 28 : 7));
    });
    if (!reducedMotion && letterT > MORPH + playLength(PATTERNS[WORD[letter]]) + HOLD) setLetter((letter + 1) % WORD.length);
  }

  const t0 = performance.now();
  let last = t0;
  function draw() {
    uniforms.uTime.value = (performance.now() - t0) / 1000;
    els.forEach((el, k) => {
      // keep the water's volume: a drop that is stretching quickly gets thinner for a moment
      const thin = Math.min(0.3, Math.abs(el.vh) * 0.12);
      uniforms.uEl.value[k].set(el.x, Math.max(0, el.h), Math.max(0, el.r) * (1 - thin), el.glow);
    });
    renderer.render(scene, camera);
  }

  // pointer moves the light on the water, eased
  const lightTarget = new THREE.Vector2(-0.45, 0.6);
  const onPointer = (e) => {
    const r = host.getBoundingClientRect();
    lightTarget.set(((e.clientX - r.left) / r.width - 0.5) * 1.6, -((e.clientY - r.top) / r.height - 0.5) * 1.6 + 0.3);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let raf = 0, inView = true;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    step(dt);
    uniforms.uLight.value.lerp(lightTarget, Math.min(1, dt * 4));
    draw();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || !inView || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(uniforms.uRes.value);
    if (!running) draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  setTheme(theme);
  setLetter(0, true);
  resize();

  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; inView ? start() : stop(); });
  const onVisibility = () => (document.hidden ? stop() : start());
  if (reducedMotion) {
    slots = []; draw(); // still frame; a tap steps to the next letter instead of animating
  } else {
    io.observe(host);
    document.addEventListener('visibilitychange', onVisibility);
    start();
  }
  requestAnimationFrame(() => host.classList.add('scene-ready'));

  function replay() {
    if (reducedMotion) { setLetter((letter + 1) % WORD.length, true); draw(); return letter; }
    letterT = MORPH; // play the current letter again from its first drop
    return letter;
  }

  function dispose() {
    stop(); ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    mesh.geometry.dispose(); mesh.material.dispose(); renderer.dispose();
    canvas.remove(); host.classList.remove('scene-ready');
  }
  return { dispose, setTheme, replay };
}
