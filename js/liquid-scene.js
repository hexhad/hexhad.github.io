// Hero WebGL scene: a noise-displaced "shader gradient" plane (after ruucm/shadergradient)
// plus an optional liquid-chrome logo (inspired by paper-design/liquid-logo, own shader).
// Loaded lazily from main.js; the page renders fine without it (CSS fallback background).

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

// Ashima 3D classic Perlin noise (MIT), same noise shadergradient uses for displacement.
const CNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0=floor(P),Pi1=Pi0+vec3(1.0);Pi0=mod289(Pi0);Pi1=mod289(Pi1);
  vec3 Pf0=fract(P),Pf1=Pf0-vec3(1.0);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x),iy=vec4(Pi0.yy,Pi1.yy);
  vec4 iz0=Pi0.zzzz,iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy),ixy0=permute(ixy+iz0),ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0*(1.0/7.0),gy0=fract(floor(gx0)*(1.0/7.0))-0.5;gx0=fract(gx0);
  vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0),sz0=step(gz0,vec4(0.0));
  gx0-=sz0*(step(0.0,gx0)-0.5);gy0-=sz0*(step(0.0,gy0)-0.5);
  vec4 gx1=ixy1*(1.0/7.0),gy1=fract(floor(gx1)*(1.0/7.0))-0.5;gx1=fract(gx1);
  vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1),sz1=step(gz1,vec4(0.0));
  gx1-=sz1*(step(0.0,gx1)-0.5);gy1-=sz1*(step(0.0,gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x),g100=vec3(gx0.y,gy0.y,gz0.y),g010=vec3(gx0.z,gy0.z,gz0.z),g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x),g101=vec3(gx1.y,gy1.y,gz1.y),g011=vec3(gx1.z,gy1.z,gz1.z),g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 n0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=n0.x;g010*=n0.y;g100*=n0.z;g110*=n0.w;
  vec4 n1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=n1.x;g011*=n1.y;g101*=n1.z;g111*=n1.w;
  float n000=dot(g000,Pf0),n100=dot(g100,vec3(Pf1.x,Pf0.yz)),n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)),n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z)),n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z)),n011=dot(g011,vec3(Pf0.x,Pf1.yz)),n111=dot(g111,Pf1);
  vec3 f=fade(Pf0);
  vec4 nz=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),f.z);
  vec2 nyz=mix(nz.xy,nz.zw,f.y);
  return 2.2*mix(nyz.x,nyz.y,f.x);
}`;

const GRADIENT_VERT = /* glsl */ `
${CNOISE}
uniform float uTime;
uniform float uDensity;
uniform float uStrength;
varying vec3 vPos;
varying float vDist;
void main(){
  float d = 0.75 * cnoise(vec3(position.xy * 0.43 * uDensity, uTime));
  vec3 p = position + normal * d * uStrength;
  vPos = p;
  vDist = d;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const GRADIENT_FRAG = /* glsl */ `
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uAccent;
varying vec3 vPos;
varying float vDist;
void main(){
  vec3 col = mix(uC1, uC2, smoothstep(-3.0, 3.0, vPos.x + vPos.y * 0.6));
  col = mix(col, uC3, smoothstep(0.25, 1.05, vDist) * uAccent);
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  float l = dot(n, normalize(vec3(-0.35, 0.55, 0.75))) * 0.5 + 0.5;
  col *= 0.62 + 0.55 * l;
  gl_FragColor = vec4(col, 1.0);
}`;

const MARK_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Liquid chrome: height from a blurred glyph mask, reflected through a banded palette with a
// per-channel offset (fake dispersion). Written for this site, not copied from liquid-logo.
const MARK_FRAG = /* glsl */ `
uniform sampler2D uMask;
uniform float uTime;
uniform vec2 uTilt;
varying vec2 vUv;

vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-0.5,ox=floor(x+0.5),a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

vec3 palette(float x){
  x = fract(x);
  vec3 deep  = vec3(0.00, 0.10, 0.12);
  vec3 steel = vec3(0.38, 0.55, 0.57);
  vec3 white = vec3(0.95, 0.98, 0.94);
  vec3 lime  = vec3(0.88, 1.00, 0.32);
  vec3 c = mix(deep, steel, smoothstep(0.00, 0.34, x));
  c = mix(c, white, smoothstep(0.34, 0.40, x));
  c = mix(c, deep,  smoothstep(0.44, 0.62, x));
  c = mix(c, lime,  smoothstep(0.76, 0.82, x) * (1.0 - smoothstep(0.86, 0.94, x)));
  return c;
}

void main(){
  vec4 m = texture2D(uMask, vUv);
  float a = m.r;
  if (a < 0.004) discard;
  float h = m.g;
  float e = 3.0 / 512.0;
  float hx = texture2D(uMask, vUv + vec2(e, 0.)).g - texture2D(uMask, vUv - vec2(e, 0.)).g;
  float hy = texture2D(uMask, vUv + vec2(0., e)).g - texture2D(uMask, vUv - vec2(0., e)).g;
  vec3 n = normalize(vec3(-hx * 5.0, -hy * 5.0, 1.0));

  float t = uTime * 0.07;
  float nz = snoise(vUv * 2.2 + vec2(t, -t * 0.7));
  float bevel = 1.0 - smoothstep(0.3, 0.85, h);
  float band = dot(vUv - 0.5, vec2(0.75, -0.66)) * 1.3
             + n.x * 0.42 + n.y * 0.32
             + nz * 0.07 + bevel * 0.22
             + uTilt.x * 0.10 - uTilt.y * 0.06
             - t;
  float disp = 0.008 + 0.014 * bevel;
  vec3 col = vec3(palette(band + disp).r, palette(band).g, palette(band - disp * 1.4).b);
  float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.55, 0.75))), 0.0), 28.0);
  col += spec * 0.45;
  col *= mix(0.72, 1.0, smoothstep(0.25, 0.7, h));
  gl_FragColor = vec4(col * a, a);
}`;

// Mask texture from the logo image: R = sharp alpha, G = blurred alpha (used as bevel height).
async function makeMaskTexture(THREE, src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const S = 512, pad = 40;
  const sharp = document.createElement('canvas');
  sharp.width = sharp.height = S;
  const sc = sharp.getContext('2d');
  sc.fillStyle = '#000';
  sc.fillRect(0, 0, S, S);
  sc.drawImage(img, pad, pad, S - pad * 2, S - pad * 2); // logo is white on transparent

  const soft = document.createElement('canvas');
  soft.width = soft.height = S;
  const bc = soft.getContext('2d');
  bc.filter = 'blur(9px)';
  bc.drawImage(sharp, 0, 0);

  const a = sc.getImageData(0, 0, S, S);
  const b = bc.getImageData(0, 0, S, S).data;
  const px = a.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i + 1] = b[i];
    px[i + 2] = 0;
    px[i + 3] = 255;
  }
  sc.putImageData(a, 0, 0);
  const tex = new THREE.CanvasTexture(sharp);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Mounts the hero scene into `host`. Returns a dispose function.
 * @param {{ host: HTMLElement, markEl?: HTMLElement | null, reducedMotion: boolean }} opts
 */
export async function mountLiquidScene({ host, markEl = null, reducedMotion }) {
  const THREE = await import(THREE_URL);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.autoClear = false;
  const canvas = renderer.domElement;
  canvas.className = 'scene-canvas';
  host.appendChild(canvas);

  // Gradient plane
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 5.2);
  const gradientUniforms = {
    uTime: { value: 0 },
    uDensity: { value: 1.25 },
    uStrength: { value: 1.35 },
    uC1: { value: new THREE.Color('#001417') },
    uC2: { value: new THREE.Color('#00505a') },
    uC3: { value: new THREE.Color('#d4f24c') },
    uAccent: { value: 0.7 },
  };
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28, 220, 220),
    new THREE.ShaderMaterial({ vertexShader: GRADIENT_VERT, fragmentShader: GRADIENT_FRAG, uniforms: gradientUniforms }),
  );
  plane.rotation.set(-0.55, 0, -0.45);
  plane.position.set(1.2, 0, -2.2);
  scene.add(plane);

  // Monogram overlay (pixel-space ortho camera so it can track a DOM placeholder)
  let markScene = null, markCamera = null, markMesh = null, markUniforms = null, maskTex = null;
  if (markEl) {
    maskTex = await makeMaskTexture(THREE, markEl.dataset.src);
    markUniforms = { uMask: { value: maskTex }, uTime: { value: 0 }, uTilt: { value: new THREE.Vector2() } };
    markScene = new THREE.Scene();
    markCamera = new THREE.OrthographicCamera(0, 1, 0, -1, -1, 1);
    markMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: MARK_VERT, fragmentShader: MARK_FRAG, uniforms: markUniforms,
        transparent: true, premultipliedAlpha: true, depthTest: false,
      }),
    );
    markScene.add(markMesh);
  }

  function layout() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (markEl && markMesh) {
      const hr = host.getBoundingClientRect(), mr = markEl.getBoundingClientRect();
      const visible = mr.width > 0 && getComputedStyle(markEl).display !== 'none';
      markMesh.visible = visible;
      markCamera.right = w; markCamera.bottom = -h;
      markCamera.updateProjectionMatrix();
      const size = Math.min(mr.width, mr.height);
      markMesh.scale.set(size, size, 1);
      markMesh.position.set(mr.left - hr.left + mr.width / 2, -(mr.top - hr.top + mr.height / 2), 0);
    }
  }

  // Decorative pointer tilt, spring-smoothed (never tied 1:1 to the cursor).
  const target = { x: 0, y: 0 }, tilt = { x: 0, y: 0, vx: 0, vy: 0 };
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function onPointer(e) {
    const r = host.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  }
  if (finePointer && !reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });

  function draw(time) {
    gradientUniforms.uTime.value = time * 0.00009;
    renderer.clear();
    renderer.render(scene, camera);
    if (markScene && markMesh.visible) {
      markUniforms.uTime.value = time * 0.001;
      markUniforms.uTilt.value.set(tilt.x, tilt.y);
      renderer.clearDepth();
      renderer.render(markScene, markCamera);
    }
  }

  let raf = 0, running = false, inView = true;
  const t0 = performance.now() - 20000;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    // critically-damped-ish spring toward the pointer target
    const k = 0.035, d = 0.82;
    tilt.vx = (tilt.vx + (target.x - tilt.x) * k) * d;
    tilt.vy = (tilt.vy + (target.y - tilt.y) * k) * d;
    tilt.x += tilt.vx; tilt.y += tilt.vy;
    camera.position.x = tilt.x * 0.25;
    camera.position.y = -tilt.y * 0.18;
    camera.lookAt(0, 0, 0);
    draw(now - t0);
  }
  function start() { if (!running && inView && !document.hidden) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const ro = new ResizeObserver(() => { layout(); if (!running) draw(performance.now() - t0); });
  ro.observe(host);
  if (markEl) ro.observe(markEl);
  layout();

  let io = null;
  const onVisibility = () => (document.hidden ? stop() : start());
  if (reducedMotion) {
    draw(20000); // one still frame
  } else {
    io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; inView ? start() : stop(); });
    io.observe(host);
    document.addEventListener('visibilitychange', onVisibility);
    start();
  }
  requestAnimationFrame(() => host.classList.add('scene-ready'));

  return function dispose() {
    stop();
    ro.disconnect();
    io?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    plane.geometry.dispose(); plane.material.dispose();
    if (markMesh) { markMesh.geometry.dispose(); markMesh.material.dispose(); maskTex.dispose(); }
    renderer.dispose();
    canvas.remove();
    host.classList.remove('scene-ready');
  };
}
