import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { buildHouse } from './model.js';

const data = await (await fetch('./data/house.json')).json();
const levels = Object.fromEntries(data.levels.map(l => [l.id, l]));
const CENTER = new THREE.Vector3(data.meta.lot.width / 2, 3.5, data.meta.lot.depth / 2);

const el = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = false;
el.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
el.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe9f0);
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0b0, 1.5));
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const fill = new THREE.DirectionalLight(0xffffff, 0.9); fill.position.set(CENTER.x + 15, 12, CENTER.z - 20); scene.add(fill);
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(CENTER.x - 12, 25, CENTER.z + 14);
sun.target.position.copy(CENTER);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
scene.add(sun, sun.target);

const house = buildHouse(data);
scene.add(house.root);

// ---------- hotspots ----------
const hsGroup = new THREE.Group(); hsGroup.name = 'hotspots'; scene.add(hsGroup);
const hsColor = { inverter: 0xff9900, battery: 0xff9900, gateway: 0xff9900, ev_charger: 0x22aa55, router: 0x2277ff, wifi_ap: 0x2277ff, camera: 0xdd3344, smarthome_gateway: 0x9944cc };
const hotspots = data.hotspots.map(h => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), new THREE.MeshStandardMaterial({ color: hsColor[h.type] ?? 0xffaa00, emissive: hsColor[h.type] ?? 0xffaa00, emissiveIntensity: 0.6 }));
  m.position.fromArray(h.pos); m.name = 'hotspot:' + h.id;
  m.userData = { pick: 'hotspot', hotspot: h, floor: h.floor };
  const d = document.createElement('div'); d.className = 'hs'; d.textContent = h.label + (h.placeholder ? ' (ตัวอย่าง)' : '');
  const lbl = new CSS2DObject(d); lbl.position.set(0, 0.35, 0); m.add(lbl); m.userData.label = lbl;
  hsGroup.add(m); return m;
});

// ---------- room labels ----------
const roomLabels = data.rooms.map(r => {
  const d = document.createElement('div'); d.className = 'lbl';
  d.innerHTML = `<b>${r.name}</b>` + (r.area ? `<br><span>${r.area.toFixed(2)} ตร.ม.</span>` : '');
  const o = new CSS2DObject(d);
  const [x0, z0, x1, z1] = r.rect;
  o.position.set((x0 + x1) / 2, (r.elev ?? levels[r.floor].elevation) + 0.15, (z0 + z1) / 2);
  o.userData.floor = r.floor; scene.add(o); return o;
});

// ---------- cameras & controls ----------
const persp = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
const HOME_DIR = new THREE.Vector3(15, 15.5, 25).normalize();
function homeView() {
  const a = innerWidth / innerHeight, dist = 34 / Math.min(1, a * 1.25);
  persp.position.copy(CENTER).addScaledVector(HOME_DIR, dist);
  if (controls) { controls.target.copy(CENTER); controls.update(); }
}
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
ortho.up.set(0, 0, -1);
let camera = persp, controls;
function makeControls() {
  controls?.dispose();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(state.mode === 'plan' ? new THREE.Vector3(CENTER.x, 0, CENTER.z) : CENTER);
  if (state.mode === 'plan') {
    controls.enableRotate = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.screenSpacePanning = true;
  } else {
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 4; controls.maxDistance = 90;
  }
  controls.update();
}
function fitOrtho() {
  const a = innerWidth / innerHeight, need = 12.5; // half-extent in meters
  const hw = Math.max(need, need * 0.62 * a), hh = hw / a;
  Object.assign(ortho, { left: -hw, right: hw, top: hh, bottom: -hh });
  ortho.position.set(CENTER.x, 60, CENTER.z); ortho.lookAt(CENTER.x, 0, CENTER.z);
  ortho.zoom = 1; ortho.updateProjectionMatrix();
}

// ---------- elevation / named views ----------
function setView(name) {
  state.floor = 'all'; state.mode = '3d'; state.elev = name !== 'persp-fl';
  const c = new THREE.Vector3(10.15, 0, 5.45);
  const PRESETS = { 'drone-fl': [[-5, 25, 23], [9, 8.5, 5.5]], 'photo-front': [[10.5, 1.8, 30], [9.8, 5.2, 6]], 'photo-front-right': [[25, 2.0, 17.5], [13, 5, 5]], 'photo-left': [[-8, 1.8, 11], [3, 5, 5.5]], 'photo-back': [[9, 2.2, -9], [9, 4.6, 3]] };
  if (PRESETS[name]) {
    state.elev = false; camera = persp; makeControls();
    const [pos, tgt] = PRESETS[name], t = new THREE.Vector3(...tgt), dir = new THREE.Vector3(...pos).sub(t), k = 1 / Math.min(1, (innerWidth / innerHeight) * 1.25);
    persp.position.copy(t).addScaledVector(dir, k); controls.target.copy(t); controls.update(); apply(); return;
  }
  if (name === 'persp-fl') {
    camera = persp; makeControls();
    const t = new THREE.Vector3(8.5, 4.6, 5.5), k = 1 / Math.min(1, (innerWidth / innerHeight) * 1.25);
    persp.position.copy(t).addScaledVector(new THREE.Vector3(-17.5, 6.4, 21.5), k); controls.target.copy(t); controls.update(); apply(); return;
  }
  const dirs = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0] };
  const d = dirs[name]; if (!d) return;
  camera = ortho; ortho.up.set(0, name === 'top' ? 0 : 1, name === 'top' ? -1 : 0);
  const a = innerWidth / innerHeight, wide = name === 'front' || name === 'back' || name === 'top' ? 12 : 8.5;
  const hw = Math.max(wide, 6.5 * a), hh = hw / a;
  Object.assign(ortho, { left: -hw, right: hw, top: hh, bottom: -hh, zoom: 1 });
  const tgt = new THREE.Vector3(name === 'front' || name === 'back' || name === 'top' ? 10.15 : c.x, name === 'top' ? 0 : 5.0, c.z);
  if (name === 'left' || name === 'right') tgt.x = name === 'left' ? 0 : 20.3;
  ortho.position.copy(tgt).add(new THREE.Vector3(...d).multiplyScalar(60));
  ortho.lookAt(tgt); ortho.updateProjectionMatrix();
  makeControls(); controls.enableRotate = false; controls.maxPolarAngle = Math.PI; controls.minPolarAngle = 0; controls.target.copy(tgt); controls.update(); apply();
}
window.setView = setView;

// ---------- state ----------
const state = { floor: 'all', mode: '3d', iso: false, showHs: true };
const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
function apply() {
  const f = state.floor === 'all' ? (state.mode === 'plan' ? 1 : 'all') : +state.floor;
  const maxF = f === 'all' ? 4 : f;
  for (const [id, g] of Object.entries(house.floorGroups)) g.visible = +id <= maxF && !(state.iso && +id < maxF);
  house.roofGroup.visible = f === 'all';
  sun.castShadow = state.mode !== 'plan' && !state.elev;
  sun.intensity = state.mode === 'plan' ? 1.0 : 1.8;
  house.boundary.visible = !state.elev;
  for (const pw of Object.values(house.planWalls)) pw.visible = state.mode === 'plan';
  renderer.clippingPlanes = f === 'all' ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), levels[f].elevation + 1.3)];
  for (const l of roomLabels) l.visible = f !== 'all' && l.userData.floor === f;
  for (const h of hotspots) {
    h.visible = state.showHs && (f === 'all' || (h.userData.floor <= f && !(state.iso && h.userData.floor < f)));
    h.userData.label.visible = h.visible && f !== 'all' && h.userData.floor === f;
  }
  for (const m of Object.values(house.roomMeshes)) {
    m.material.color.setHex(state.mode === 'plan' ? m.material.userData.plan : m.material.userData.base);
  }
  document.querySelectorAll('#floors button').forEach(b => b.classList.toggle('on', b.dataset.f === String(state.floor) || (state.floor === 'all' && state.mode === 'plan' && b.dataset.f === '1')));
  document.getElementById('mode').textContent = state.mode === 'plan' ? 'มุม 3D' : 'ผัง 2D';
  document.getElementById('mode').classList.toggle('on', state.mode === 'plan');
}
function setMode(m) {
  state.mode = m; state.elev = false;
  if (m === 'plan') { if (state.floor === 'all') state.floor = 1; camera = ortho; ortho.up.set(0, 0, -1); fitOrtho(); }
  else camera = persp;
  makeControls(); apply();
}

document.querySelectorAll('#floors button').forEach(b => b.onclick = () => {
  state.floor = b.dataset.f === 'all' ? 'all' : +b.dataset.f;
  if (state.elev) { state.elev = false; camera = persp; makeControls(); homeView(); }
  if (state.floor === 'all' && state.mode === 'plan') setMode('3d');
  if (state.floor === 'all' && state.mode === '3d') homeView();
  apply(); hideInfo();
});
document.getElementById('mode').onclick = () => setMode(state.mode === 'plan' ? '3d' : 'plan');
document.getElementById('iso').onchange = e => { state.iso = e.target.checked; apply(); };
document.getElementById('hsT').onchange = e => { state.showHs = e.target.checked; apply(); };
document.getElementById('carT').onchange = e => { house.cars.visible = e.target.checked; };
document.getElementById('solarBtn').onclick = () => focusSolar();

// ---------- info / picking ----------
const info = document.getElementById('info');
let selected = null;
function highlight(objs) {
  if (selected) for (const o of selected) o.material.emissive?.setHex(0);
  selected = objs;
  if (objs) for (const o of objs) o.material.emissive.setHex(0x2f6f4f);
}
function showInfo(title, html) { info.querySelector('h3').textContent = title; info.querySelector('.body').innerHTML = html; info.style.display = 'block'; }
function hideInfo() { info.style.display = 'none'; highlight(null); }
document.getElementById('close').onclick = hideInfo;

const panelMats = []; house.solar.traverse(o => { if (o.isMesh && !panelMats.includes(o.material)) panelMats.push(o.material); });
function solarInfo(p) {
  const S = data.solar, list = (S.strings || []).map(s => s.label).join('<br>');
  showInfo(p ? (p.userData.stringLabel || 'แผงโซลาร์เซลล์') : 'แผงโซลาร์เซลล์', `<p>รวม ${S.count} แผง${S.kWp ? ' · ' + S.kWp + ' kWp' : ''} · ${(S.strings || []).length} สตริง</p>${p ? `<p>แผงที่ ${p.userData.panelIndex}</p>` : `<p>${list}</p>`}<p>ระบบ: Sigenergy SigenStor (ข้อมูลกำลังผลิตจริงจะต่อในขั้นถัดไป)</p><span class="tag">ตำแหน่งแผงโดยประมาณจากภาพโดรน</span>`);
}
function focusSolar() {
  state.floor = 'all'; if (state.mode === 'plan') setMode('3d'); apply();
  persp.position.set(CENTER.x + 4, 26, CENTER.z + 14); controls.target.set(8.7, 9.5, 5.4); controls.update();
  highlight(null);
  panelMats.forEach(m => m.emissive.setHex(0x1f4f8f)); setTimeout(() => panelMats.forEach(m => m.emissive.setHex(0)), 1500);
  solarInfo(null);
}

const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const visibleDeep = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const targets = [...house.pickables, ...hotspots].filter(visibleDeep);
  const hit = ray.intersectObjects(targets, false)[0];
  if (!hit) return hideInfo();
  const o = hit.object, u = o.userData;
  if (u.pick === 'room') {
    const r = u.room; const [x0, z0, x1, z1] = r.rect;
    highlight([o]);
    showInfo(r.name, `<p>${levels[r.floor].name}</p><p>พื้นที่ตามแบบ: ${r.area ? r.area.toFixed(2) + ' ตร.ม.' : 'ไม่ระบุ'}</p><p style="font-size:12px">ขนาดโมเดล ≈ ${(x1 - x0).toFixed(2)} × ${(z1 - z0).toFixed(2)} ม.</p>`);
  } else if (u.pick === 'solar') { highlight([...o.parent.children]); solarInfo(o); }
  else if (u.pick === 'hotspot') {
    const h = u.hotspot; highlight(null);
    showInfo(h.label, `<p>${levels[h.floor].name} · ประเภท: ${h.type}</p>${h.placeholder ? '<span class="tag">ตำแหน่งตัวอย่าง — ยังไม่ใช่ตำแหน่งจริง</span>' : ''}`);
  }
});

// ---------- loop ----------
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
  persp.aspect = innerWidth / innerHeight; persp.updateProjectionMatrix(); fitOrtho();
});
homeView(); makeControls(); apply();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera); });

// ---------- URL params (for sharing / screenshots) ----------
const q = new URLSearchParams(location.search);
if (q.get('iso') === '1') { state.iso = true; document.getElementById('iso').checked = true; }
if (q.get('f')) state.floor = q.get('f') === 'all' ? 'all' : +q.get('f');
if (q.get('mode') === 'plan') setMode('plan'); else apply();
if (q.get('solar') === '1') focusSolar();
if (q.get('cars') === '1') { house.cars.visible = true; document.getElementById('carT').checked = true; }
if (q.get('hs') === '0') { state.showHs = false; document.getElementById('hsT').checked = false; }
if (q.get('view')) setView(q.get('view'));

// ---------- GLB export (used by tools/shoot.mjs) ----------
window.exportGLB = async () => {
  const { GLTFExporter } = await import('three/addons/GLTFExporter.js');
  const prev = { ...state }; state.floor = 'all'; state.iso = false; state.mode = '3d'; apply();
  const exp = new THREE.Group(); exp.name = 'home';
  const h = house.root.clone(true); h.getObjectByName('cars')?.removeFromParent(); [1, 2, 3].forEach(i => h.getObjectByName('plan-walls-' + i)?.removeFromParent()); exp.add(h);
  const hs = new THREE.Group(); hs.name = 'hotspots';
  for (const m of hotspots) { const c = new THREE.Mesh(m.geometry, m.material); c.position.copy(m.position); c.name = m.name; c.userData = { hotspot: m.userData.hotspot }; hs.add(c); }
  exp.add(hs);
  exp.traverse(o => { if (o.userData) { const u = { ...o.userData }; delete u.label; if (u.room) u.room = { id: u.room.id, name: u.room.name, area: u.room.area }; o.userData = u; } });
  const buf = await new GLTFExporter().parseAsync(exp, { binary: true, onlyVisible: false });
  Object.assign(state, prev); apply();
  let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
window.__ready = true;
// test helper: screen position of the first panel of a string
window.__panelScreen = id => { const g = house.solar.getObjectByName('string-' + id); if (!g) return null; const v = new THREE.Vector3(); g.children[0].getWorldPosition(v); v.project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
