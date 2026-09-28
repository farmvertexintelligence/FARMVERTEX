/* FarmVertex Intelligence - scroll-driven 3D scene.
   One fixed WebGL canvas per page. The geometry is chosen by <body data-shape>,
   and page scroll progress (via GSAP ScrollTrigger) drives rotation, drift,
   camera depth and how far the vertices lift off the wireframe. */
(function () {
  'use strict';
  var host = document.getElementById('scene');
  if (!host || typeof THREE === 'undefined') return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSmall = function () { return window.innerWidth < 768; };

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  function cssColor(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return new THREE.Color(v || fallback);
  }

  function makeGeometry(kind) {
    switch (kind) {
      case 'dodeca': return new THREE.DodecahedronGeometry(1.7, 0);
      case 'octa': return new THREE.OctahedronGeometry(1.9, 1);
      case 'knot': return new THREE.TorusKnotGeometry(1.15, 0.36, 90, 10, 2, 3);
      case 'lattice': return new THREE.IcosahedronGeometry(1.8, 2);
      case 'torus': return new THREE.TorusGeometry(1.4, 0.55, 12, 36);
      case 'tetra': return new THREE.TetrahedronGeometry(2.0, 1);
      case 'box': return new THREE.BoxGeometry(2.2, 2.2, 2.2, 3, 3, 3);
      default: return new THREE.IcosahedronGeometry(1.8, 1);
    }
  }

  var kind = document.body.getAttribute('data-shape') || 'icosa';
  var geo = makeGeometry(kind);

  var root = new THREE.Group();
  scene.add(root);
  var core = new THREE.Group();
  root.add(core);

  // Faceted inner body
  var bodyMat = new THREE.MeshStandardMaterial({
    flatShading: true, roughness: 0.55, metalness: 0.25, transparent: true, opacity: 0.92
  });
  var body = new THREE.Mesh(geo, bodyMat);
  body.scale.setScalar(0.985);
  core.add(body);

  // Gold edges
  var edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 });
  var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), edgeMat);
  core.add(edges);

  // Vertices (deduplicated) as points that lift away on scroll
  var pos = geo.attributes.position;
  var seen = {}, verts = [];
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    var key = x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3);
    if (!seen[key]) { seen[key] = 1; verts.push(x, y, z); }
  }
  var vGeo = new THREE.BufferGeometry();
  var base = new Float32Array(verts);
  vGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  var vMat = new THREE.PointsMaterial({ size: verts.length / 3 > 150 ? 0.04 : 0.075, sizeAttenuation: true, transparent: true, opacity: 1 });
  var vPoints = new THREE.Points(vGeo, vMat);
  core.add(vPoints);

  // Orbit rings
  var ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35 });
  var ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.006, 6, 160), ringMat);
  var ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.004, 6, 160), ringMat);
  ring1.rotation.x = Math.PI / 2.3;
  ring2.rotation.x = Math.PI / 1.8; ring2.rotation.y = 0.5;
  root.add(ring1, ring2);

  // Ambient node field
  var N = isSmall() ? 260 : 520;
  var field = new Float32Array(N * 3);
  for (var j = 0; j < N; j++) {
    var r = 6 + Math.random() * 12;
    var th = Math.random() * Math.PI * 2;
    var ph = Math.acos(2 * Math.random() - 1);
    field[j * 3] = r * Math.sin(ph) * Math.cos(th);
    field[j * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
    field[j * 3 + 2] = r * Math.cos(ph) - 6;
  }
  var fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(field, 3));
  var fMat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.55 });
  var fieldPts = new THREE.Points(fGeo, fMat);
  scene.add(fieldPts);

  // Lights
  var amb = new THREE.AmbientLight(0xffffff, 1.1);
  var key1 = new THREE.DirectionalLight(0xffffff, 2.4);
  key1.position.set(4, 5, 6);
  var rim = new THREE.PointLight(0xffffff, 40, 30, 2);
  rim.position.set(-5, -2, 3);
  scene.add(amb, key1, rim);

  function applyTheme() {
    var gold = cssColor('--gold', '#A67C34');
    var green = cssColor('--green', '#1E3A2F');
    var ink = cssColor('--ink', '#16201B');
    var dark = cssColor('--bg', '#F2EEE4').getHSL({}).l < 0.4;
    bodyMat.color = green;
    bodyMat.emissive = green.clone().multiplyScalar(dark ? 0.25 : 0.05);
    edgeMat.color = gold;
    vMat.color = gold;
    ringMat.color = gold;
    rim.color = gold;
    fMat.color = dark ? gold : ink;
    fMat.opacity = dark ? 0.45 : 0.35;
    render();
  }

  // Scroll state
  var progress = 0, eased = 0;
  var mouseX = 0, mouseY = 0, mx = 0, my = 0;
  var anchor = document.body.getAttribute('data-anchor') === 'center' ? 0 : 1;

  function layout() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }

  var clock = new THREE.Clock();
  function frame(t) {
    eased += (progress - eased) * 0.08;
    mx += (mouseX - mx) * 0.05;
    my += (mouseY - my) * 0.05;
    var p = eased;
    var small = isSmall();

    // Drift across the page: starts right (next to hero copy), weaves as sections pass.
    var startX = small ? 0 : 2.6 * anchor;
    var weave = small ? 0 : Math.sin(p * Math.PI * 2.2) * 2.4;
    root.position.x = startX * (1 - Math.min(p * 3, 1)) + weave * Math.min(p * 3, 1);
    root.position.y = small ? 1.4 - p * 1.2 : Math.sin(p * Math.PI) * -0.4;

    core.rotation.y = p * Math.PI * 3 + t * 0.08 + mx * 0.3;
    core.rotation.x = p * Math.PI * 1.2 + my * 0.2;
    ring1.rotation.z = p * Math.PI * 2 + t * 0.05;
    ring2.rotation.z = -p * Math.PI * 1.6 - t * 0.04;

    // Camera dolly: pushes in through the middle of the page, eases back out at the end.
    var dolly = Math.sin(p * Math.PI);
    camera.position.z = (small ? 11 : 9) - dolly * 2.6;
    camera.position.x = mx * 0.4;
    camera.position.y = my * 0.3;
    camera.lookAt(root.position.x * 0.4, 0, 0);

    // Vertices lift off the wireframe as the page is explored.
    var lift = 1 + dolly * 0.35 + Math.sin(t * 0.9) * 0.012;
    var arr = vGeo.attributes.position.array;
    for (var k = 0; k < arr.length; k++) arr[k] = base[k] * lift;
    vGeo.attributes.position.needsUpdate = true;
    edgeMat.opacity = 0.9 - dolly * 0.35;
    bodyMat.opacity = 0.92 - dolly * 0.5;

    fieldPts.rotation.y = p * 0.8 + t * 0.01;
    fieldPts.position.z = p * 4;

    renderer.domElement.style.opacity = small ? 0.55 : 1;
    render();
  }
  function render() { renderer.render(scene, camera); }

  var running = false, rafId = 0;
  function loop() {
    if (!running) return;
    frame(clock.getElapsedTime());
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (!running && !reduceMotion) { running = true; loop(); } }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  window.addEventListener('resize', layout);
  window.addEventListener('pointermove', function (e) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // Page-level scroll progress from ScrollTrigger (no raw scroll listeners).
  function bindScroll() {
    if (window.gsap && window.ScrollTrigger) {
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: function (self) { progress = self.progress; if (reduceMotion) { eased = progress; frame(0); } }
      });
    }
  }

  applyTheme();
  layout();
  bindScroll();
  if (reduceMotion) frame(0); else start();
})();
