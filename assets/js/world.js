/* FarmVertex Intelligence - 3D world.
   A glass-and-gold core sits in the hero; a field of particles morphs into a
   different formation as each [data-shape] section scrolls into view.
   Scroll also drives the camera dolly, the field's rotation and its offset
   ([data-x] on the active section). */
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const host = document.getElementById('world');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (host && hasWebGL()) init();

function init() {
  const small = () => window.innerWidth < 768;
  const COUNT = small() ? 4200 : 9000;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 14);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  /* ---------- Shapes (particle targets) ---------- */
  const rnd = mulberry(7);
  const SHAPES = {
    sphere(i, n) { // fibonacci sphere with a soft shell
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.39996;
      const R = 3.6 + (rnd() - 0.5) * 0.25;
      return [Math.cos(t) * r * R, y * R, Math.sin(t) * r * R];
    },
    grid(i, n) { // modular cube lattice
      const s = Math.ceil(Math.cbrt(n)), x = i % s, y = Math.floor(i / s) % s, z = Math.floor(i / (s * s));
      const k = 6.2 / s;
      return [(x - s / 2) * k, (y - s / 2) * k, (z - s / 2) * k];
    },
    helix(i, n) { // double helix
      const strand = i % 2, t = (i / n) * Math.PI * 9, h = (i / n - 0.5) * 11;
      const R = 2.1 + (rnd() - 0.5) * 0.18, a = t + strand * Math.PI;
      if (rnd() < 0.12) { const f = rnd(); return [Math.cos(t) * R * (2 * f - 1), h, Math.sin(t) * R * (2 * f - 1)]; }
      return [Math.cos(a) * R, h, Math.sin(a) * R];
    },
    network(i, n) { // clustered nodes
      const clusters = 14, c = i % clusters;
      const cr = mulberry(c + 11);
      const cx = (cr() - 0.5) * 9, cy = (cr() - 0.5) * 6, cz = (cr() - 0.5) * 6;
      if (rnd() < 0.25) { // links between clusters
        const d = (c + 1 + Math.floor(rnd() * 3)) % clusters, dr = mulberry(d + 11), f = rnd();
        const dx = (dr() - 0.5) * 9, dy = (dr() - 0.5) * 6, dz = (dr() - 0.5) * 6;
        return [cx + (dx - cx) * f, cy + (dy - cy) * f, cz + (dz - cz) * f];
      }
      const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1), r = Math.pow(rnd(), 2) * 0.7;
      return [cx + r * Math.sin(v) * Math.cos(u), cy + r * Math.sin(v) * Math.sin(u), cz + r * Math.cos(v)];
    },
    rings(i, n) { // orbital rings
      const ring = i % 5, t = rnd() * Math.PI * 2, R = 1.6 + ring * 0.75;
      const tilt = ring * 0.55, j = (rnd() - 0.5) * 0.08;
      const x = Math.cos(t) * R, z = Math.sin(t) * R;
      return [x, z * Math.sin(tilt) + j, z * Math.cos(tilt) + j];
    },
    wave(i, n) { // flowing surface
      const s = Math.ceil(Math.sqrt(n)), gx = (i % s) / s - 0.5, gz = Math.floor(i / s) / s - 0.5;
      const x = gx * 13, z = gz * 9;
      return [x, Math.sin(x * 0.7) * 0.8 + Math.cos(z * 0.9) * 0.6 - 0.5, z];
    },
    layers(i, n) { // stacked platform layers
      const L = i % 5, a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (3.4 - L * 0.35);
      const edge = rnd() < 0.3 ? (3.4 - L * 0.35) : r;
      return [Math.cos(a) * edge, (L - 2) * 1.05, Math.sin(a) * edge];
    },
    knot(i, n) { // torus knot
      const t = (i / n) * Math.PI * 2, p = 2, q = 3, tube = 0.45 * Math.sqrt(rnd());
      const r = Math.cos(q * t) + 2.2;
      const x = r * Math.cos(p * t), y = r * Math.sin(p * t), z = -Math.sin(q * t);
      const a = rnd() * Math.PI * 2;
      return [x * 1.25 + Math.cos(a) * tube, y * 1.25 + Math.sin(a) * tube, z * 1.25 + Math.sin(a) * tube];
    },
    scatter(i, n) { // ambient starfield
      const r = 6 + rnd() * 14, u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
      return [r * Math.sin(v) * Math.cos(u), r * Math.sin(v) * Math.sin(u) * 0.6, r * Math.cos(v) - 4];
    }
  };
  const cache = {};
  function shapeArray(name) {
    if (cache[name]) return cache[name];
    const f = SHAPES[name] || SHAPES.sphere, a = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) { const p = f(i, COUNT); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; }
    return (cache[name] = a);
  }

  /* ---------- Particles ---------- */
  const geo = new THREE.BufferGeometry();
  const first = document.querySelector('[data-shape]');
  let currentShape = first ? first.getAttribute('data-shape') : 'sphere';
  const from = new Float32Array(shapeArray('scatter'));
  const to = new Float32Array(shapeArray(currentShape));
  const rand = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) rand[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  geo.setAttribute('aTo', new THREE.BufferAttribute(to, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

  const uniforms = {
    uMix: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 0 },
    uSize: { value: small() ? 50 : 62 }, uPR: { value: renderer.getPixelRatio() },
    uGold: { value: new THREE.Color('#D8BF82') }, uIvory: { value: new THREE.Color('#EFEBE3') }, uGreen: { value: new THREE.Color('#3FA67A') }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aFrom; attribute vec3 aTo; attribute float aRand;
      uniform float uMix, uTime, uSize, uPR;
      varying float vRand; varying float vDepth;
      void main() {
        float m = clamp(uMix * 1.4 - aRand * 0.4, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 p = mix(aFrom, aTo, m);
        float swirl = sin(m * 3.14159);
        p += swirl * vec3(sin(aRand * 40.0 + uTime), cos(aRand * 23.0 + uTime * 1.3), sin(aRand * 11.0 + uTime * 0.7)) * 0.9;
        p += 0.035 * vec3(sin(uTime * 0.9 + aRand * 20.0), cos(uTime * 0.7 + aRand * 15.0), sin(uTime * 0.5 + aRand * 9.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (0.5 + aRand * 0.9) / -mv.z;
        vRand = aRand; vDepth = -mv.z;
      }`,
    fragmentShader: `
      uniform vec3 uGold, uIvory, uGreen; uniform float uOpacity;
      varying float vRand; varying float vDepth;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        vec3 c = vRand > 0.86 ? uIvory : (vRand < 0.14 ? uGreen : uGold);
        float fog = smoothstep(30.0, 8.0, vDepth);
        gl_FragColor = vec4(c, a * a * uOpacity * fog * 0.85);
      }`
  });
  const points = new THREE.Points(geo, mat);
  const field = new THREE.Group();
  field.add(points);
  scene.add(field);

  /* ---------- Glass core ---------- */
  const core = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.55, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.35, ior: 1.18,
      attenuationColor: new THREE.Color('#E9D6A8'), attenuationDistance: 3.5, envMapIntensity: 1.4,
      clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true
    })
  );
  const goldMat = new THREE.MeshStandardMaterial({ color: '#D8BF82', metalness: 1, roughness: 0.22, envMapIntensity: 1.3 });
  // The FarmVertex mark (spire + two blades), extruded in gold at the heart of the glass.
  const tri = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - 512) / 440, (419 - y) / 440)));
  const logoGeo = new THREE.ExtrudeGeometry(
    [tri([[512, 100], [538, 325], [486, 325]]), tri([[512, 325], [392, 738], [185, 738]]), tri([[512, 325], [838, 738], [632, 738]])],
    { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 }
  );
  logoGeo.center();
  const inner = new THREE.Mesh(logoGeo, goldMat);
  inner.rotation.order = 'YXZ'; // inverse of the core's XYZ rotation
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.018, 16, 200), goldMat);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.01, 16, 200), goldMat);
  ringA.rotation.x = Math.PI / 2.4; ringB.rotation.set(Math.PI / 1.7, 0.4, 0);
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.58, 0)),
    new THREE.LineBasicMaterial({ color: '#E9D6A8', transparent: true, opacity: 0.55 })
  );
  core.add(glass, inner, cage, ringA, ringB);
  scene.add(core);
  const key = new THREE.DirectionalLight(0xfff1d6, 2.2); key.position.set(4, 6, 5); scene.add(key);
  const fill = new THREE.PointLight(0x3fa67a, 30, 20, 2); fill.position.set(-4, -2, 3); scene.add(fill);
  const hasCore = !!document.querySelector('.hero:not(.hero-sub)');

  /* ---------- State ---------- */
  const state = { heroOut: 0, page: 0, fieldX: 0, targetX: 0, mx: 0, my: 0, tx: 0, ty: 0 };
  let transitionTween = null;

  function currentPositions() {
    const out = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      let m = Math.min(Math.max(uniforms.uMix.value * 1.4 - rand[i] * 0.4, 0), 1);
      m = m * m * (3 - 2 * m);
      for (let k = 0; k < 3; k++) { const j = i * 3 + k; out[j] = from[j] + (to[j] - from[j]) * m; }
    }
    return out;
  }
  function morphTo(name) {
    if (!name || name === currentShape) return;
    currentShape = name;
    from.set(currentPositions());
    to.set(shapeArray(name));
    geo.attributes.aFrom.needsUpdate = true;
    geo.attributes.aTo.needsUpdate = true;
    uniforms.uMix.value = 0;
    if (transitionTween) transitionTween.kill();
    if (reduce || !window.gsap) { uniforms.uMix.value = 1; render(); return; }
    transitionTween = gsap.to(uniforms.uMix, { value: 1, duration: 2.2, ease: 'power3.inOut' });
  }

  /* ---------- Scroll bindings ---------- */
  function bindScroll() {
    if (!window.gsap || !window.ScrollTrigger) { uniforms.uMix.value = 1; uniforms.uOpacity.value = 1; return; }
    gsap.registerPlugin(ScrollTrigger);
    // Intro: particles gather from the starfield into the first formation.
    if (reduce) { uniforms.uMix.value = 1; uniforms.uOpacity.value = 1; }
    else {
      gsap.to(uniforms.uOpacity, { value: 1, duration: 1.8, ease: 'power2.out', delay: 0.3 });
      transitionTween = gsap.to(uniforms.uMix, { value: 1, duration: 3, ease: 'power3.inOut', delay: 0.2 });
    }
    document.querySelectorAll('[data-shape]').forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec, start: 'top 55%', end: 'bottom 45%',
        onToggle: (self) => {
          if (!self.isActive) return;
          morphTo(sec.getAttribute('data-shape'));
          state.targetX = parseFloat(sec.getAttribute('data-x') || '0');
        }
      });
    });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { state.page = s.progress; if (reduce) render(); } });
    const hero = document.querySelector('.hero');
    if (hero) {
      ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: (s) => { state.heroOut = s.progress; if (reduce) render(); } });
    }
  }

  /* ---------- Loop ---------- */
  const clock = new THREE.Clock();
  let raf = 0, running = false;
  function frame() {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    // Frame for the screen's shape, not just its width: tall screens (phones,
    // portrait tablets, "desktop site" mode on phones) get the centred layout.
    const aspect = window.innerWidth / window.innerHeight;
    const s = small() || aspect < 1;
    const camZ = s ? 17 : 14;
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camZ * aspect;
    state.mx += (state.tx - state.mx) * 0.04;
    state.my += (state.ty - state.my) * 0.04;
    state.fieldX += ((s ? 0 : state.targetX) - state.fieldX) * 0.035;

    // Field: gentle spin, scroll-driven rotation, section offset.
    field.rotation.y = t * 0.04 + state.page * Math.PI * 1.6 + state.mx * 0.25;
    field.rotation.x = Math.sin(t * 0.1) * 0.08 + state.my * 0.15;
    field.position.x = state.fieldX * Math.min(5.2, halfW * 0.6);
    field.position.y = s ? 1.2 : 0;
    // On tall screens, shrink the field so it fits the width.
    field.scale.setScalar(s ? Math.min(1, Math.max(0.55, halfW / 3.9)) : 1);

    // Core: floats in the hero, then flies toward the camera and dissolves.
    if (hasCore) {
      const h = state.heroOut;
      core.visible = h < 0.98;
      // Keep the core (rings included) inside the right edge on narrower landscape screens.
      const coreX = Math.min(3.5, Math.max(0, halfW - 2.6));
      core.position.set(s ? 0 : coreX * (1 - h), (s ? 2.7 : 1.35) + Math.sin(t * 0.8) * 0.12, h * 9.5);
      core.rotation.set(t * 0.18 + state.my * 0.3, t * 0.26 + state.mx * 0.4, 0);
      // Counter-rotate against the glass so the mark stays upright and readable.
      inner.rotation.set(-core.rotation.x, -core.rotation.y + Math.sin(t * 0.6) * 0.5, 0);
      ringA.rotation.z = t * 0.3; ringB.rotation.z = -t * 0.22;
      const sc = (s ? Math.min(0.7, halfW / 4.2) : 0.82) * (1 + h * 0.6);
      core.scale.setScalar(sc);
    } else {
      core.visible = false;
    }

    // Camera: dolly in through mid-page, parallax with pointer.
    const dolly = Math.sin(state.page * Math.PI);
    camera.position.z = camZ - dolly * 3.5;
    camera.position.x = state.mx * 0.6;
    camera.position.y = state.my * 0.4;
    camera.lookAt(0, 0, 0);
    render();
  }
  function render() { renderer.render(scene, camera); }
  function loop() { if (!running) return; frame(); raf = requestAnimationFrame(loop); }
  function start() { if (!running && !reduce) { running = true; clock.start(); loop(); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (reduce) frame();
  });
  window.addEventListener('pointermove', (e) => {
    state.tx = (e.clientX / window.innerWidth) * 2 - 1;
    state.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  bindScroll();
  if (reduce) frame(); else start();
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
