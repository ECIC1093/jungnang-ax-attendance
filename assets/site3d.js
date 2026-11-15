/* 3D 공사 현장 장면: 중랑구청 건물·주변·크레인·헬기·사다리차·인부·장비·마감·출범 축하.
 * 원래 prototype/screen-prototype.html 안의 main()을 그대로 옮겼다(작업 02).
 * 쓰는 법: const site = Site3D.start();  → site.arrive({ name, dept, rank, role }), site.mayorArrive(), site.state
 *   새로고침 뒤 이어 그리기: 첫 arrive 전에 한 번 site.restore({ people: [{ name, dept, rank, role, at? }], mayor: true/false })
 *   성능 낮춤: 주소에 ?q=low → 흐린 배경 캔버스 끔(먼 배경은 본 화면에 같이 그림), 그림자·해상도 낮춤, 폭죽·꽃가루 절반
 * 필요한 것: THREE(r128) 전역, index.html의 #stage·#stageBg 캔버스와 안내판 요소(#nCount·#barFill·#phase·#logList·#toasts·#finale 등).
 * arrive(p) 자료: { name(≤40자), dept(소속 ≤60자, 빈 값 가능), rank(직위, 직접 입력이면 빈 값 가능), role(council/director/deputy/speaker/panel 또는 없음), at?(등록 시각) }
 *   알림 카드·숫자는 arrive 즉시, 칸은 운반 수단이 비는 대로. */
(function () {
'use strict';
function start() {
const $ = id => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = /[?&]q=low(&|$)/.test(location.search);   // 성능 낮춤 모드(행사 노트북이 버거울 때)
const FX = LOW ? 0.5 : 1;                               // 폭죽·꽃가루 양 배율

/* ===== 설정 ===== */
const EXPECTED = 70;              // 참석 예정 인원
/* 실제 중랑구청 배치 — 청사 평면도(1993, 70.2m × 85.8m)와 항공·광장 사진 기준. 1칸(단위) = 약 3m.
   화면: +z = 동쪽 잔디광장(카메라 쪽), -x = 남쪽 봉화산로(간판 모서리), +x = 북쪽 8m 도로, -z = 서쪽(봉화산로47길)
   1~4층은 'ㅁ+ㅡ' 모양 고리: 동쪽 날개(잔디광장 정면) · 서쪽 날개 · 북쪽 띠 · 가운데 동서 막대(E~H열)
   남쪽 안마당은 봉화산로 쪽으로 열려 있고, 북쪽 안뜰은 막혀 있다. 5층부터는 4층 옥상 위로 가운데 막대만 남아 7층까지 올라간다(양 끝 둥근 옥탑).
   4층 옥상(앞·뒤 모두)은 옥상정원.
   칸은 잘게 나눔: 1~4층마다 34칸(동쪽 정면 20 + 서쪽·북쪽·가운데 14) × 4 + 5~7층 막대 4칸 × 3 = 148칸.
   참석 1명이 2칸을 올린다(70명 남짓이면 거의 다 지어짐). 칸을 다 지어도 마감(옥상·옥탑·정원 등)과 준공 연출은 구청장 몫 */
const SEG = 2.6, BASE = 0.4, FHS = [2.2, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6];   // 1층은 기둥 사이 긴 창이라 높게
const yAt = f => BASE + FHS.slice(0, f).reduce((a, b) => a + b, 0);
const MAIN_FLOORS = 4, BAR_FLOORS = 7;
const MAIN_TOP = yAt(MAIN_FLOORS), TOP = yAt(BAR_FLOORS);
const RX = m => +((m - 42.9) / 3).toFixed(2);          // 평면도 행(A~M, m) → x
const CZ = m => +(4.5 - (70.2 - m) / 3).toFixed(2);    // 평면도 열(1~10, m) → z
const R = { A: RX(0), E: RX(31.2), H: RX(46.8), K: RX(70.2), L: RX(78), M: RX(85.8) };
const C = { c1: CZ(0), c2: CZ(9.6), c3: CZ(15.6), c8: CZ(54.6), c9: CZ(60.6), c10: CZ(70.2) };
const PROJ = 1.2;                                       // 현관 탑부가 앞으로 나온 길이
const V = {
  ES: { x0: R.A, x1: R.E, z0: C.c8, z1: C.c10, name: '동쪽 날개(남)' },
  T:  { x0: R.E, x1: R.H, z0: C.c8, z1: C.c10 + PROJ, name: '현관 탑부' },
  EN: { x0: R.H, x1: R.L, z0: C.c8, z1: C.c10, name: '동쪽 날개(북)' },
  NB: { x0: R.L, x1: R.M, z0: C.c2, z1: C.c9, name: '북쪽 띠' },
  NK: { x0: R.K, x1: R.L, z0: C.c3, z1: C.c8, name: '북쪽 코어' },
  BAR:{ x0: R.E, x1: R.H, z0: C.c3, z1: C.c8, name: '가운데 동' },
  WN: { x0: R.E, x1: R.L, z0: C.c1, z1: C.c3, name: '서쪽 날개(북)' },
  WS: { x0: R.A, x1: R.E, z0: C.c1, z1: C.c3, name: '서쪽 날개(남·구의회)' },
  // 평면도 1~4층: 중앙광장 남쪽 두 모서리의 계단실(A열, 3~4·7~8번 사이)과 가운데 동 서쪽 끝 돌출부(F~G행, 1번 밖)
  SS1:{ x0: R.A - 0.5, x1: R.A + 2.0, z0: C.c3, z1: CZ(23.4), name: '계단실(서)' },
  SS2:{ x0: R.A - 0.5, x1: R.A + 2.0, z0: CZ(46.8), z1: C.c8, name: '계단실(동)' },
  TW: { x0: RX(35.1), x1: RX(42.9), z0: C.c1 - 1.2, z1: C.c1, name: '서쪽 돌출부' },
};
const NK5 = { x0: R.K, x1: R.L, z0: CZ(23.4), z1: CZ(39) };   // 5층 평면도: 4층 옥상 위로 남은 북쪽 작은 방 2개
const UPPER = { x0: R.E, x1: R.H, z0: C.c1, z1: C.c10 };   // 5~6층 가운데 막대
const ZF = V.T.z1, Z0 = C.c10;                              // ZF: 탑부 앞면, Z0: 동쪽 정면
const XC = (R.E + R.H) / 2;                                 // 현관·가운데 막대 중심선
const TARGET_Z = -7;                                        // 카메라가 바라보는 건물 중심
const DEFS = [];                                            // 쌓는 순서
const SPLIT = { ES: [4, 2], T: [2, 2], EN: [4, 2], WS: [2, 1], WN: [4, 1], NB: [1, 3], NK: [1, 2], BAR: [1, 3], SS1: [1, 1], SS2: [1, 1], TW: [1, 1] };   // [x방향, z방향] 나눔 수
function cellsOf(vol, v, f, nx, nz) {
  const out = [], w = (v.x1 - v.x0) / nx, d = (v.z1 - v.z0) / nz;
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) out.push({ vol, f, i: iz, ix, x0: v.x0 + ix * w, x1: v.x0 + (ix + 1) * w, z0: v.z0 + iz * d, z1: v.z0 + (iz + 1) * d });
  return out;
}
for (let f = 0; f < BAR_FLOORS; f++) {
  if (f < MAIN_FLOORS) {
    const front = []; ['ES', 'T', 'EN'].forEach(vol => front.push(...cellsOf(vol, V[vol], f, ...SPLIT[vol])));
    (f % 2 ? front.reverse() : front).forEach(d => DEFS.push(d));
    ['SS1', 'SS2', 'WS', 'TW', 'WN', 'NB', 'NK', 'BAR'].forEach(vol => cellsOf(vol, V[vol], f, ...SPLIT[vol]).forEach(d => DEFS.push(d)));
  } else {
    cellsOf('U', UPPER, f, 1, 4).forEach(d => DEFS.push(d));   // 서쪽에서 동쪽(정면) 쪽으로
    if (f === MAIN_FLOORS) DEFS.push({ vol: 'NK5', f, ...NK5 });
  }
}
const TOTAL = DEFS.length;        // 148칸
const PER_PERSON = 2;             // 참석 1명당 올라가는 칸 수

/* ===== 3D 기본 ===== */
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
// 먼 배경 전용(그림자 없음, 낮은 해상도 — CSS로 흐리게 하므로 충분). 성능 낮춤 모드에선 끄고 본 화면에 같이 그린다
let rendererBg = null;
if (LOW) $('stageBg').hidden = true;
else { rendererBg = new THREE.WebGLRenderer({ canvas: $('stageBg'), antialias: false, alpha: true }); rendererBg.setPixelRatio(Math.min(devicePixelRatio, 2) * 0.5); rendererBg.outputEncoding = THREE.sRGBEncoding; }
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe8ee, 100, 340);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 800);

const hemi = new THREE.HemisphereLight(0xdfefff, 0x8a7a5c, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dc, 1.0);
sun.position.set(-30, 45, 28); sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 180 });
scene.add(sun);

const M = c => new THREE.MeshLambertMaterial({ color: c });
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'number' ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}
function cyl(rt, rb, h, mat, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof mat === 'number' ? M(mat) : mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
}

/* ===== 주변 배경 =====
   가까운 것(현장·잔디광장·주변 도로)은 또렷하게, 먼 것(산·아파트·동네)은 따로 그려 흐리게(#stageBg에 CSS blur) — 시연 영상의 만화풍 배경
   지도 기준: 남쪽(-x) 봉화산로(넓은 길·메타세쿼이아·건널목), 동쪽(+z) 잔디광장 앞 길, 북쪽(+x) 8m 도로와 봉화산, 서쪽(-z) 봉화산로47길 너머 아파트 */
const BG = 1;                                                   // 흐린 배경 레이어 번호
const toBg = o => { o.traverse(c => c.layers.set(BG)); return o; };
hemi.layers.enableAll(); sun.layers.enableAll();
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const NEAR = { x0: -62, x1: 62, z0: -69, z1: 55 };             // 또렷하게 그릴 범위
const inNear = (x, z) => x > NEAR.x0 && x < NEAR.x1 && z > NEAR.z0 && z < NEAR.z1;
function flat(w, d, color, x, z, y = 0.02) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), typeof color === 'number' ? M(color) : color); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; }
function flatBoth(w, d, color, x, z, y = 0.02) {               // 먼 쪽은 흐린 레이어에 통째로, 가까운 쪽은 잘라서 또렷하게
  toBg(flat(w, d, color, x, z, y));
  const x0 = Math.max(x - w / 2, NEAR.x0), x1 = Math.min(x + w / 2, NEAR.x1), z0 = Math.max(z - d / 2, NEAR.z0), z1 = Math.min(z + d / 2, NEAR.z1);
  if (x1 > x0 && z1 > z0) flat(x1 - x0, z1 - z0, color, (x0 + x1) / 2, (z0 + z1) / 2, y);
}
const grassM = M(0x8fae68);
flatBoth(800, 800, grassM, 0, 0, 0);
const ROAD = { south: -25, east: 23, north: 22.5, west: -28 };   // 길 중심선
const asphalt = M(0x4b5059), walkM = M(0xc9c3b5), lineM = M(0xf1f1e8), yellowM = M(0xe8b830);
flatBoth(9, 420, asphalt, ROAD.south, -60); flatBoth(2.4, 420, walkM, ROAD.south + 5.7, -60, 0.015); flatBoth(2.4, 420, walkM, ROAD.south - 5.7, -60, 0.015);   // 봉화산로
// 잔디광장 건너 길: 봉화산로에서 북쪽 길까지만 이어지는 단지 안 길(양쪽에 차가 줄지어 주차) — 위성사진 기준
flatBoth(ROAD.north - ROAD.south, 6, asphalt, (ROAD.north + ROAD.south) / 2, ROAD.east);   // 끝은 앞마당(지하주차장 입구 앞) flatBoth(ROAD.north - ROAD.south, 1.4, walkM, (ROAD.north + ROAD.south) / 2, ROAD.east - 3.7, 0.015);
// 북쪽 길(건물 북쪽 면 따라 나가는 출구 길)·서쪽 봉화산로47길은 아래 '언덕' 다음에 그린다(오르막이라 언덕 높이가 필요)
flatBoth(9, 300, asphalt, -150, -60); flatBoth(300, 8, asphalt, 20, -150); flatBoth(260, 7, asphalt, 140, -20);                                   // 먼 동네 길
for (let z = NEAR.z0 + 2; z <= NEAR.z1 - 2; z += 7) if (Math.abs(z - ROAD.east) > 6) box(0.22, 0.02, 3.4, yellowM, ROAD.south, 0.04, z, scene);
for (let x = ROAD.south + 7; x <= ROAD.north - 4; x += 6) box(3, 0.02, 0.22, lineM, x, 0.04, ROAD.east, scene);
for (let i = 0; i < 8; i++) box(0.6, 0.02, 3.6, lineM, ROAD.south - 3.6 + i * 1.03, 0.045, ROAD.east - 6.5, scene);   // 봉화산로 건널목
for (let i = 0; i < 5; i++) box(0.6, 0.02, 3.2, lineM, ROAD.south - 3.6 + i * 1.8, 0.045, -7.2, scene);              // 중앙광장 앞 건널목
// 주차된 차(잔디광장 앞 길 가장자리)
for (let x = ROAD.south + 8, k = 0; x <= ROAD.north - 3; x += 4.6, k++) [ROAD.east - 2.1, ROAD.east + 2.1].forEach((z, s) => {   // 길 양쪽 주차
  if ((k + s) % 4 === 3) return;
  const g = new THREE.Group(); box(4, 0.9, 1.8, [0xffffff, 0x3b6fb6, 0x9aa4b0, 0x2a2d33, 0xd33b2c][(k * 3 + s) % 5], 0, 0.7, 0, g); box(2.2, 0.7, 1.6, 0x26323d, -0.2, 1.45, 0, g); g.position.set(x, 0, z); scene.add(g);
});
// 봉화산(북쪽 뒤) — 낮은 다면체 산 + 숲 덩어리, 꼭대기 봉수대 정자
const hillM = new THREE.MeshLambertMaterial({ color: 0x4f7f3f, flatShading: true });
const forestM = [M(0x3f6f34), M(0x4d8a3c), M(0x5f9a45), M(0x6f9c4a)];
// 봉화산: 청사 바로 북서·서쪽 뒤에서 솟는 숲(위성사진), 멀리 다른 능선
const hills = [[82, 0, -62, 58, 34, 58], [30, 0, -112, 70, 30, 48], [130, 0, -140, 70, 26, 50], [-40, 0, -160, 70, 22, 40]];
const bump = new THREE.SphereGeometry(1, 7, 5), bumps = [];
hills.forEach(([x, y, z, rx, ry, rz]) => {
  const g = new THREE.SphereGeometry(1, 30, 12, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {   // 위치로 정한 울퉁불퉁함(이음매가 벌어지지 않게)
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const k = py > 0.05 ? 1 + 0.07 * Math.sin(px * 9.1 + pz * 5.3 + x) * Math.cos(pz * 7.7 - px * 3.1) : 1;
    p.setXYZ(i, px * k, py * k, pz * k);
  }
  g.computeVertexNormals();
  const h = new THREE.Mesh(g, hillM); h.scale.set(rx, ry, rz); h.position.set(x, y, z); scene.add(toBg(h));
  for (let n = 0; n < 260; n++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.96, px = Math.cos(a) * r, pz = Math.sin(a) * r;
    const py = Math.sqrt(Math.max(0, 1 - px * px - pz * pz));
    bumps.push([x + px * rx, y + py * ry, z + pz * rz, 2 + rnd() * 2.2]);
  }
});
forestM.forEach((m, mi) => {
  const list = bumps.filter((_, i) => i % forestM.length === mi), im = new THREE.InstancedMesh(bump, m, list.length), o = new THREE.Object3D();
  list.forEach(([x, y, z, s], i) => { o.position.set(x, y, z); o.scale.set(s, s * 0.8, s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  scene.add(toBg(im));
});
{ const [hx, , hz, , hy] = hills[0], p = new THREE.Group(); box(4, 2.4, 4, 0xd9c9a6, 0, 1.2, 0, p); box(5.4, 0.8, 5.4, 0x8a4b3a, 0, 2.8, 0, p); p.position.set(hx, hy - 0.5, hz); scene.add(toBg(p)); }
// 아파트 단지(서쪽, 봉화산로47길 너머): 흰 벽 + 분홍빛 발코니 줄
const bgLit = [];
function aptTex(lit) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = lit ? '#000' : '#f1efea'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 4; c++) {
      const x = 6 + c * 30, y = 6 + r * 15.6;
      if (lit) { if (((r * 7 + c * 3) % 5) < 3) { g.fillStyle = '#ffcf7a'; g.fillRect(x + 3, y + 2, 20, 9); } continue; }
      g.fillStyle = '#b98a8a'; g.fillRect(x, y, 26, 12); g.fillStyle = '#5b6c78'; g.fillRect(x + 3, y + 2, 20, 8);
    }
    if (!lit) { g.fillStyle = '#4f9a63'; g.fillRect(0, 0, w, 5); }
  });
}
const aptMap = aptTex(false), aptLitMap = aptTex(true);
[aptMap, aptLitMap].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); });
const aptMat = new THREE.MeshLambertMaterial({ map: aptMap, emissive: 0x000000, emissiveMap: aptLitMap }); bgLit.push([aptMat, 0.7]);
const aptSide = M(0xe6e3dc), aptTop = M(0x6aa77a);
[[-6, -78, 24, 34, 8], [24, -86, 24, 38, 8], [-38, -84, 24, 36, 8], [-18, -110, 22, 40, 8], [14, -118, 22, 34, 8], [-60, -70, 22, 30, 8]]
  .forEach(([x, z, w, h, d]) => { const m = box(w, h, d, [aptSide, aptSide, aptTop, aptTop, aptMat, aptMat], x, h / 2, z); m.rotation.y = -1.1; scene.add(toBg(m)); });   // 카메라 쪽을 보게
// 동네(먼 저층 건물들) — 산과 아파트를 피해 흩뿌림
{
  const walls = [0xe8e2d6, 0xd9d4ca, 0xe3d2bd, 0xcfd8de, 0xf0ebe2], roofs = [0x8a6d5c, 0x6e8f6e, 0x7fa3b8, 0xb56a4a, 0x9aa0a6];
  const blocked = (x, z) => hills.some(([hx, , hz, rx, , rz]) => ((x - hx) / rx) ** 2 + ((z - hz) / rz) ** 2 < 1.15) || (x > -70 && x < 40 && z < -60 && z > -130) || inNear(x, z);
  for (let n = 0, made = 0; n < 400 && made < 60; n++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 120, x = Math.cos(a) * r, z = -7 + Math.sin(a) * r;
    if (blocked(x, z)) continue;
    const w = 8 + rnd() * 12, d = 8 + rnd() * 10, h = 3 + rnd() * (rnd() < 0.2 ? 18 : 8), k = made % 5;
    const g = new THREE.Group(); box(w, h, d, walls[k], 0, h / 2, 0, g); box(w + 0.4, 0.5, d + 0.4, roofs[(k + 2) % 5], 0, h + 0.25, 0, g);
    g.position.set(x, 0, z); g.rotation.y = rnd() * 0.5;
    if (!onRoad(x, z, w, d, g.rotation.y)) scene.add(toBg(g));   // 길 위에 걸치는 집은 그리지 않음(무작위 순서는 그대로 두려고 계산은 같이 함)
    made++;
  }
}
// 먼 길(봉화산로·먼 동네 길) 위에 걸치는지: 돌린 사각형의 바깥 상자로 확인
function onRoad(x, z, w, d, rot) {
  const hx = (w * Math.abs(Math.cos(rot)) + d * Math.abs(Math.sin(rot))) / 2 + 1, hz = (w * Math.abs(Math.sin(rot)) + d * Math.abs(Math.cos(rot))) / 2 + 1;
  const roads = [[ROAD.south - 7, ROAD.south + 7, -270, 150], [-155, -145, -210, 90], [-130, 170, -155, -145], [10, 270, -24, -16]];
  return roads.some(([x0, x1, z0, z1]) => x + hx > x0 && x - hx < x1 && z + hz > z0 && z - hz < z1);
}
// 위성사진(카카오맵) 기준 주변: 북서·서쪽 바로 뒤가 봉화산 숲, 잔디광장 건너(북동)는 아파트 단지와 큰 주차장, 47길 건너(남서)는 낮은 흰 아파트
// (예전 '보건소' 상자는 지움: 중랑구보건소는 구청 건물 북쪽 면 안에 있음 — 거리뷰 2026-11-15. 그 상자는 북쪽 길 위에 걸쳐 있었음)
{ // 잔디광장 건너 북동쪽 아파트 단지(초록 지붕 6층) + 단지 주차장
  const lotM = M(0x9a9da3), wall = M(0xeeeae2), roof = M(0x4f9a7a), win = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#eeeae2'; c.fillRect(0, 0, w, h); c.fillStyle = '#6f8290'; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) c.fillRect(4 + k * 15, 5 + r * 15, 9, 8); });
  win.wrapS = win.wrapT = THREE.RepeatWrapping; win.repeat.set(6, 2.4);
  const face = new THREE.MeshLambertMaterial({ map: win, emissive: 0x000000, emissiveMap: aptLitMap }); bgLit.push([face, 0.45]);
  flatBoth(66, 34, lotM, 15, 46, 0.02);   // x -18 ~ 48(봉화산로 보도와 안 겹치게)
  for (let x = -16; x <= 44; x += 2.6) [33, 38.5, 52].forEach(z => { if ((x * 7 + z) % 5 > 1) { const c = new THREE.Group(); box(2, 0.8, 4, [0xffffff, 0x2a2d33, 0xd33b2c, 0x9aa4b0, 0x3b6fb6][Math.abs(Math.round(x * 3 + z)) % 5], 0, 0.6, 0, c); box(1.7, 0.6, 2.2, 0x26323d, 0, 1.2, -0.2, c); c.position.set(x, 0, z); scene.add(c); } });
  [[-6, 45.5, 24, 10, 8], [26, 45.5, 24, 10, 8], [10, 59, 30, 10, 8], [44, 59, 22, 10, 8]].forEach(([x, z, w, h, d]) => {
    const m = box(w, h, d, [wall, wall, roof, roof, face, face], x, h / 2, z, scene); box(w + 0.4, 0.5, d + 0.4, roof, x, h + 0.25, z, scene);
  });
}
{ // 47길 건너 남서쪽 낮은 흰 아파트
  const wall = M(0xf0eee8), roof = M(0x9aa0a6);
  // 봉화산로(x -29.5~-20.5)·보도(-18.1까지)와 47길(z -30.5~-25.5)·그 가로수(z -32.5)를 피한 자리. 예전 x -30 두 동은 봉화산로 위에 있었음
  [[-11.5, -44, 9, 18], [1.5, -44, 9, 18], [14, -44, 8, 16], [-11.5, -63, 9, 18], [1.5, -63, 9, 18]].forEach(([x, z, w, d]) => { box(w, 9, d, wall, x, 4.5, z, scene); box(w + 0.4, 0.5, d + 0.4, roof, x, 9.25, z, scene); });
}
/* 언덕: 동문 잔디광장·옆 차도·건물 북쪽 길(봉화산로45길 아래쪽)은 봉화산 자락을 깎아 평평하게 만든 땅이다
   (사용자 설명 + 사진 + 카카오 스카이뷰, 2026-11-15). 북쪽(+x) 숲 쪽은 한 단 높고(HILL.h ≈ 4.5m), 깎인 면은 인공 암벽·옹벽.
   - 잔디광장 옆 차도는 앞마당에서 끝나고, 정면이 지하주차장 입구다(출구·입구 칸이 차도와 일직선). 입구 건물 폭 = 잔디광장 끝 ~ 차도 끝.
   - 지하주차장에 안 들어가는 차는 앞마당에서 왼쪽(-z)으로 꺾어 **건물 북쪽 면을 따라 서쪽으로 나간다**(봉화산로45길 쪽 출구 길, 보건소 앞).
     (거리뷰 2026-11-15: 앞마당 서쪽 끝에서 서쪽을 보면 왼쪽 건물·오른쪽 계단 사이로 길이 이어짐, 나간 뒤 돌아본 사진도 같은 길)
   - 계단은 그 출구 길 오른쪽(북쪽), 입구 건물 서쪽 끝 옆에서 숲·암벽 쪽(+x)으로 올라간다.
   - 반원 데크(입구 지붕)는 위쪽 땅 높이. 데크 뒤 위쪽 길은 숲 속으로 이어진다(45길 윗부분, 연결은 줄여 그림).
   - 차도 오른쪽(+z) 아파트 쪽은 옹벽 + 흰 난간(아파트 땅이 높음). 가까운 범위(NEAR)만 높인다 */
const PK = { x: ROAD.north, z0: 8.5, z1: ROAD.east + 3.5 };      // 주차장 입구 앞면(x)과 폭(z): 잔디광장 끝 ~ 차도 끝
const HILL = { h: 1.5, rockX: ROAD.north + 2.7, roadX: ROAD.north + 10.5, stairZ0: 2, stairZ1: 6, stairX1: ROAD.north + 6.3, z1: PK.z1 + 1.5 };
const hillY = (x, z) => {   // 그 자리 땅 높이(나무를 올릴 때)
  if (x >= NEAR.x1 || z <= NEAR.z0 || z >= HILL.z1) return 0;
  const x0 = z < HILL.stairZ0 ? HILL.rockX : z < HILL.stairZ1 ? HILL.stairX1 : z < PK.z0 ? HILL.rockX : PK.x;
  return x > x0 ? HILL.h : 0;
};
const wallTex = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#c9c4ba'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a9a398'; c.lineWidth = 2; for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } });
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(12, 1);
const wallM = new THREE.MeshLambertMaterial({ map: wallTex });
{
  const H = HILL.h;
  const rock = canvasTex(256, 128, (c, w, h) => {   // 인공 암벽: 베이지·회색 바위 덩어리
    c.fillStyle = '#b9b2a4'; c.fillRect(0, 0, w, h);
    for (let n = 0; n < 90; n++) { const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 18; c.fillStyle = ['#cfc8ba', '#a69e8f', '#d9d3c7', '#958d7f'][n % 4]; c.beginPath(); c.ellipse(x, y, r * 1.3, r, rnd() * 3, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(70,64,55,.35)'; c.lineWidth = 2; for (let n = 0; n < 26; n++) { c.beginPath(); const x = rnd() * w; c.moveTo(x, 0); c.lineTo(x + (rnd() - .5) * 30, h); c.stroke(); }
  });
  rock.wrapS = THREE.RepeatWrapping; rock.repeat.set(30, 1);
  const top = M(0x7da35a), side = M(0xb3ab9a), rockM = new THREE.MeshLambertMaterial({ map: rock });
  // 높은 땅 덩어리 4개(면 순서 +x, -x, 위, 아래, +z, -z)
  const blk = (x0, z0, z1, mats) => { const x1 = NEAR.x1, m = box(x1 - x0, H, z1 - z0, mats, (x0 + x1) / 2, H / 2, (z0 + z1) / 2, scene); m.castShadow = false; };
  blk(HILL.rockX, NEAR.z0, HILL.stairZ0, [side, rockM, top, side, wallM, side]);      // 건물 뒤 숲: 출구 길 쪽 암벽(인공폭포 쪽)
  blk(HILL.stairX1, HILL.stairZ0, HILL.stairZ1, [side, wallM, top, side, side, side]); // 계단 위
  blk(HILL.rockX, HILL.stairZ1, PK.z0, [side, wallM, top, side, side, wallM]);         // 계단과 입구 건물 사이 화단 옹벽
  blk(PK.x, PK.z0, HILL.z1, [side, wallM, top, side, wallM, wallM]);                   // 입구 건물·데크·아파트 쪽(앞면은 입구 그림이 덮음)
  // 출구 길(건물 북쪽 면 따라 서쪽으로): 앞마당 끝(z 6.9)에서 잠깐 평평하다가 오르막(거리뷰: 서쪽으로 올라감) → 위쪽 땅 높이로 서쪽 끝까지.
  // 높아진 길은 둑(옹벽)으로 받치고, 건물 쪽 면은 옹벽. 47길은 북쪽 끝에서 이 길 높이까지 오르막으로 만난다
  const EX = { x0: ROAD.north - 2.5, x1: ROAD.north + 2.5, zLow: 3, zTop: -12, zEnd: NEAR.z0 };
  flat(5, 6.9 - EX.zLow, asphalt, ROAD.north, (6.9 + EX.zLow) / 2, 0.02);
  const slope = (cx, cy, cz, len, wid, axis, ang) => {   // 기울어진 아스팔트 판(axis 'x' 또는 'z' 방향으로 오름)
    const g = new THREE.Group(), p = new THREE.Mesh(new THREE.PlaneGeometry(axis === 'x' ? len : wid, axis === 'x' ? wid : len), asphalt);
    p.rotation.x = -Math.PI / 2; p.receiveShadow = true; g.add(p); g.position.set(cx, cy, cz);
    if (axis === 'x') g.rotation.z = ang; else g.rotation.x = ang; scene.add(g);
  };
  const tri = (pts, rotY, pos) => {   // 오르막 옆 세모 옹벽(pts: [가로, 높이] 세 점)
    const s = new THREE.Shape(); s.moveTo(...pts[0]); s.lineTo(...pts[1]); s.lineTo(...pts[2]); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide })); m.rotation.y = rotY; m.position.set(...pos); scene.add(m);
  };
  const exLen = EX.zLow - EX.zTop;
  slope(ROAD.north, H / 2 + 0.02, (EX.zLow + EX.zTop) / 2, Math.hypot(exLen, H), 5, 'z', Math.atan2(H, exLen));
  tri([[-EX.zLow, 0], [-EX.zTop, 0], [-EX.zTop, H]], Math.PI / 2, [EX.x0, 0, 0]);                     // 건물 쪽 세모 옹벽
  { const m = box(5, H, EX.zTop - EX.zEnd, [side, wallM, asphalt, side, side, side], ROAD.north, H / 2, (EX.zTop + EX.zEnd) / 2, scene); m.castShadow = false; }
  toBg(flat(5, 51, asphalt, ROAD.north, EX.zEnd - 25.5, H + 0.02));                                    // 먼 쪽(흐린 레이어)
  // 봉화산로47길: 봉화산로 ~ x 8 평평, x 8 ~ 출구 길 오르막
  const w0 = 8, wz = ROAD.west;
  flatBoth(w0 - ROAD.south, 5, asphalt, (w0 + ROAD.south) / 2, wz);
  slope((w0 + EX.x0) / 2, H / 2 + 0.02, wz, Math.hypot(EX.x0 - w0, H), 5, 'x', Math.atan2(H, EX.x0 - w0));
  [wz - 2.5, wz + 2.5].forEach(z => tri([[w0, 0], [EX.x0, 0], [EX.x0, H]], 0, [0, 0, z]));
  // 위쪽 길: 데크 뒤(옥상 사진의 '30' 길) — 서쪽 끝은 숲 속으로 + 데크 쪽 보도
  const up = H + 0.02, rx = HILL.roadX + 2.75, rz0 = -15;
  flat(5.5, HILL.z1 - rz0, asphalt, rx, (rz0 + HILL.z1) / 2, up);
  flat(0.9, HILL.z1 - HILL.stairZ0, walkM, HILL.roadX - 0.45, (HILL.stairZ0 + HILL.z1) / 2, up + 0.005);
  for (let z = rz0 + 1; z < HILL.z1 - 1; z += 3.4) box(0.18, 0.02, 1.6, yellowM, rx, up + 0.02, z + 0.8, scene);
  box(5.5, 0.4, 0.15, 0xe6e6e6, rx, up + 0.2, HILL.z1 - 0.1, scene);                 // 길 끝 가드레일(그 너머는 아파트 단지 쪽)
  // 차도 오른쪽(아파트 쪽) 옹벽 + 흰 난간
  const fx0 = -8, fx1 = PK.x, fz = ROAD.east + 3.6, L = fx1 - fx0, white = M(0xf2f2ee);
  box(L, 0.8, 0.3, wallM, (fx0 + fx1) / 2, 0.4, fz, scene);
  [1.0, 1.3].forEach(y => box(L, 0.05, 0.06, white, (fx0 + fx1) / 2, y, fz, scene));
  for (let x = fx0 + 0.6; x < fx1; x += 1.6) box(0.12, 0.6, 0.12, white, x, 1.1, fz, scene);
}
{ // 지하주차장 입구: 깎인 면에 박힌 낮은 회색 건물 — 왼쪽(-z)은 가로 줄무늬 벽, 오른쪽(차도와 일직선)에 출구·입구 두 칸(사진 6·스카이뷰 사진 3)
  const H = HILL.h, W = PK.z1 - PK.z0, zc = (PK.z0 + PK.z1) / 2;
  const u = z => (z - PK.z0) / W;                     // 폭 안의 비율(0 = 서쪽 끝)
  const a0 = u(ROAD.east - 3) + 0.005, a2 = u(ROAD.east + 3) - 0.005, a1 = (a0 + a2) / 2;   // 출구 칸 [a0,a1] · 입구 칸 [a1,a2]
  const face = canvasTex(1728, 144, (c, w, h) => {
    c.fillStyle = '#6b7078'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#80868e'; for (let y = 50; y < h; y += 9) c.fillRect(0, y, w * (a0 - 0.02), 4);          // 가로 줄무늬 벽
    c.fillStyle = '#41464d'; c.fillRect(0, 0, w, 44);                                                       // 위 짙은 띠(표지)
    [[a0, a1 - 0.006], [a1 + 0.006, a2]].forEach(([a, b]) => { c.fillStyle = '#16181b'; c.fillRect(w * a, 48, w * (b - a), h - 56); c.fillStyle = '#2c3036'; c.fillRect(w * a, 48, w * (b - a), 9); });
    for (let x = w * a0; x < w * a2; x += 16) { c.fillStyle = (x / 16 | 0) % 2 ? '#e8b830' : '#1b1b1b'; c.fillRect(x, h - 9, 16, 9); }   // 바닥 노랑·검정 띠
    [a0 - 0.006, a1, a2 + 0.004].forEach(a => { c.fillStyle = '#8d939b'; c.fillRect(w * a - 6, 44, 12, h - 44); });
    c.textBaseline = 'middle'; c.font = '700 26px "IBM Plex Sans KR", sans-serif';
    const sign = (x, ico, txt) => { c.fillStyle = '#d8342c'; c.beginPath(); c.arc(x, 22, 13, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.fillText(ico, x - 7, 23); c.fillText(txt, x + 20, 23); };
    sign(w * (a0 + 0.02), '−', '출구 OUT'); sign(w * (a1 + 0.025), '↓', '입구 IN');
    c.fillStyle = '#fff'; c.font = '700 40px sans-serif'; c.fillText('P', w * (a0 - 0.12), 23); c.font = '600 17px "IBM Plex Sans KR", sans-serif'; c.fillText('제한높이 2.4m', w * (a0 - 0.12) + 34, 24);
  });
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: face })); fm.rotation.y = -Math.PI / 2; fm.position.set(PK.x - 0.02, H / 2, zc); fm.receiveShadow = true; scene.add(fm);
  box(0.5, 0.12, W, 0x8d939b, PK.x + 0.2, H + 0.04, zc, scene);                                         // 데크 앞 턱
}
{ // 반원 데크: 주차장 입구 지붕 = 위쪽 땅 높이. 곧은 쪽이 앞마당, 둥근 쪽이 위쪽 길. 돌 포장 + 유리 난간 + 가장자리 화단 + 앞 난간 현수막 — 사진 7·스카이뷰
  const H = HILL.h, zc = (PK.z0 + PK.z1) / 2, rz = (PK.z1 - PK.z0) / 2, rx = HILL.roadX - 1.5 - PK.x, y = H + 0.04;
  const pts = []; for (let i = 0; i <= 36; i++) { const a = -Math.PI / 2 + Math.PI * i / 36; pts.push([PK.x + rx * Math.cos(a), zc + rz * Math.sin(a)]); }
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], -pts[0][1]); pts.slice(1).forEach(([x, z]) => sh.lineTo(x, -z)); sh.closePath();
  const tile = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#cfcbc2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b4afa4'; c.lineWidth = 2; for (let i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(0.35, 0.35);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ map: tile })); deck.rotation.x = -Math.PI / 2; deck.position.y = y; deck.receiveShadow = true; scene.add(deck);
  const glass = new THREE.MeshLambertMaterial({ color: 0xbfe3ea, transparent: true, opacity: 0.4 }), railM = M(0xc9ced4), soil = M(0x6f8f4a), shrub = [M(0xc8553d), M(0x4f8a3c), M(0xd9793a)];
  const rail = (x0, z0, x1, z1) => { const l = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0); const g = box(0.06, 0.42, l, glass, (x0 + x1) / 2, y + 0.21, (z0 + z1) / 2, scene); g.rotation.y = a; g.castShadow = false; const r = box(0.08, 0.05, l, railM, (x0 + x1) / 2, y + 0.44, (z0 + z1) / 2, scene); r.rotation.y = a; };
  for (let i = 0; i < pts.length - 1; i++) if (i < 2 || i > 5) rail(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);   // 서쪽 끝 한 곳은 계단에서 들어오는 길이라 비움
  rail(PK.x + 0.05, PK.z0, PK.x + 0.05, PK.z1);                            // 앞 난간
  for (let i = 3; i < pts.length - 2; i += 2) {                            // 둥근 가장자리 화단
    if (i <= 6) continue;
    const [x, z] = pts[i], k = 0.88, px = PK.x + (x - PK.x) * k, pz = zc + (z - zc) * k;
    box(0.9, 0.18, 0.9, soil, px, y + 0.09, pz, scene);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), shrub[i % 3]); s.position.set(px, y + 0.42, pz); s.castShadow = true; scene.add(s);
  }
  [[PK.x + 2.4, zc - 2.4], [PK.x + 2.4, zc + 2.4], [PK.x + 4.4, zc]].forEach(([x, z], i) => { const b = box(0.5, 0.25, 1.6, 0x8a6d5c, x, y + 0.13, z, scene); if (i === 2) b.rotation.y = Math.PI / 2; });   // 벤치
  // 앞 난간 현수막: 행사 때 문구, 비우면 현수막 없음
  const DECK_BANNER = '제1차 중랑AX 2030 전략포럼';
  if (DECK_BANNER) {
    const bw = Math.min(PK.z1 - PK.z0 - 2, 9), tx = canvasTex(1024, 72, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1C7C38'; c.fillRect(0, 0, 70, h);
      drawJNSymbol(c, 10, 8, 56);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '400 46px "Black Han Sans", "IBM Plex Sans KR", sans-serif';
      const parts = [['제1차 ', '#0d1730'], ['중랑AX 2030 ', '#106A3A'], ['전략포럼', '#0057A3']];
      if (DECK_BANNER !== '제1차 중랑AX 2030 전략포럼') { c.fillStyle = '#0d1730'; c.fillText(DECK_BANNER, (w + 70) / 2, h / 2 + 2); return; }
      const tot = parts.reduce((s, [t]) => s + c.measureText(t).width, 0); let x = (w + 70 - tot) / 2; c.textAlign = 'left';
      parts.forEach(([t, col]) => { c.fillStyle = col; c.fillText(t, x, h / 2 + 2); x += c.measureText(t).width; });
    });
    const bmM = new THREE.MeshLambertMaterial({ map: tx, emissive: 0x000000, emissiveMap: tx }); bgLit.push([bmM, 0.4]);   // 밤에 은은히 밝게
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw * 72 / 1024), bmM); bm.rotation.y = -Math.PI / 2; bm.position.set(PK.x - 0.03, y + 0.24, zc); bm.userData.noShadow = true; scene.add(bm);
  }
}
{ // 계단: 출구 길 오른쪽(북쪽), 입구 건물 서쪽 옆에서 숲·암벽 쪽(+x)으로 — 거리뷰 사진
  const H = HILL.h, n = 7, x0 = ROAD.north + 2.5, run = (HILL.stairX1 - x0) / n, z0 = HILL.stairZ0, z1 = HILL.stairZ1, stone = M(0xcfc8b8);
  for (let k = 0; k < n; k++) { const xs = x0 + k * run, hh = H * (k + 1) / n; box(HILL.stairX1 - xs, hh, z1 - z0, stone, (xs + HILL.stairX1) / 2, hh / 2, (z0 + z1) / 2, scene); }
  [z0 + 0.08, z1 - 0.08].forEach(z => { const hr = box(Math.hypot(HILL.stairX1 - x0, H), 0.06, 0.06, 0x8b9099, (x0 + HILL.stairX1) / 2, H / 2 + 0.5, z, scene); hr.rotation.z = Math.atan2(H, HILL.stairX1 - x0); });
}
{ // 앞마당: 잔디광장 끝 ~ 입구 건물 앞, 차도 끝까지 — 짙은 블록 포장, 바닥 글씨 '주차장'(직진 → 입구) · '출구'(왼쪽 → 45길), 장애인 주차칸(입구 건물 왼쪽 앞)
  const x0 = 14.5, x1 = PK.x, z0 = 6.9, z1 = PK.z1;
  const brick = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#4f535a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5f646c'; c.lineWidth = 2; for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } } });
  brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(3, 7);
  const brickM = new THREE.MeshLambertMaterial({ map: brick });
  flat(x1 - x0, z1 - z0, brickM, (x0 + x1) / 2, (z0 + z1) / 2, 0.03);
  flat(HILL.rockX - x1, PK.z0 - z0, brickM, (x1 + HILL.rockX) / 2, (z0 + PK.z0) / 2, 0.03);   // 입구 건물 서쪽 끝 앞(출구 길로 이어지는 곳)
  const mark = (txt, x, z, rotY) => {   // 글자 + 화살표(화살표 방향 = 캔버스 오른쪽 → 그룹 회전으로 맞춤)
    const t = canvasTex(512, 160, (c, w, h) => {
      c.fillStyle = '#f1f1e8'; c.font = '700 84px "IBM Plex Sans KR", sans-serif'; c.textBaseline = 'middle'; c.fillText(txt, 16, h / 2 + 4);
      const ax = 16 + c.measureText(txt).width + 30; c.fillRect(ax, h / 2 - 9, w - ax - 90, 18);
      c.beginPath(); c.moveTo(w - 24, h / 2); c.lineTo(w - 96, h / 2 - 40); c.lineTo(w - 96, h / 2 + 40); c.fill();
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.125), new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0.85, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; const g = new THREE.Group(); g.add(m); g.rotation.y = rotY; g.position.set(x, 0.045, z); scene.add(g);
  };
  mark('주차장', x1 - 3.4, ROAD.east + 1.4, 0);              // 입구 칸으로 직진
  mark('출구', x1 - 2.2, ROAD.east - 6.5, Math.PI / 2);      // 출구 칸에서 나와 왼쪽(45길)으로
  for (let k = 0; k < 3; k++) box(2.6, 0.02, 1.3, 0x3a73c9, x0 + 1.6, 0.05, z0 + 1.0 + k * 1.5, scene);   // 장애인 주차칸: 잔디광장 끝·건물 북동쪽 모서리 옆(거리뷰 사진)
  [[x0 + 1.9, z0 + 1.0, 0xffffff], [x0 + 1.9, z0 + 2.5, 0xf4f4f0], [x1 - 2.6, z0 + 1.2, 0x2a2d33]].forEach(([x, z, col]) => { const c = new THREE.Group(); box(1.8, 0.9, 4, col, 0, 0.7, 0, c); box(1.6, 0.7, 2.2, 0x26323d, 0, 1.45, -0.2, c); c.position.set(x, 0, z); c.rotation.y = Math.PI / 2; scene.add(c); });
}
{ // 산 위 타원 잔디 공원(전경 사진 오른쪽 위) — 언덕 위
  const t = new THREE.Mesh(new THREE.CircleGeometry(1, 36), M(0xcfc6b0)); t.rotation.x = -Math.PI / 2; t.scale.set(11.5, 7.5, 1); t.position.set(50, HILL.h + 0.05, -12); t.receiveShadow = true; scene.add(t);
  const f = new THREE.Mesh(new THREE.CircleGeometry(1, 36), M(0x86b85a)); f.rotation.x = -Math.PI / 2; f.scale.set(10, 6.2, 1); f.position.set(50, HILL.h + 0.08, -12); f.receiveShadow = true; scene.add(f);
}
// 가로수: 봉화산로 메타세쿼이아 + 둥근 나무(가까운 것은 또렷, 먼 것은 흐린 레이어)
const treeCone = new THREE.ConeGeometry(1.3, 6.5, 7), treeBall = new THREE.SphereGeometry(1.9, 8, 6), trunkG = new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6);
const trees = { cone: [], ball: [] };
for (let z = -200; z <= 60; z += 4.5) { if (Math.abs(z - ROAD.east) < 4) continue; trees.cone.push([ROAD.south - 7.6, z]); if (Math.round(z / 4.5) % 2 === 0 && (z < -30 || z > 21)) trees.ball.push([ROAD.south + 6.9, z]); }   // 중앙광장 앞·슬로건 조형물 앞은 비워 둔다
for (let n = 0; n < 420; n++) {   // 숲 가장자리: 북쪽 길 건너(북서)와 47길 너머 산자락을 나무로 채움
  const x = ROAD.north + 4 + rnd() * 60, z = -90 + rnd() * 92;
  if (!(x > 31.5 && x < 40 && z > -16) && !(x > 37 && x < 63 && z > -21 && z < -3)) trees.ball.push([x, z]);   // 위쪽 길·타원 공원 자리는 비움(예전 보건소 자리는 숲으로)
}
for (let n = 0; n < 70; n++) { const x = 40 + rnd() * 21, z = -2 + rnd() * 27; trees.ball.push([x, z]); }   // 위쪽 길 너머(데크 뒤) 숲
for (let x = -18; x <= 18; x += 6) trees.ball.push([x, ROAD.west - 4.5]);
for (let n = 0; n < 160; n++) { const a = rnd() * Math.PI * 2, r = 64 + rnd() * 100; trees.ball.push([Math.cos(a) * r, -7 + Math.sin(a) * r]); }
function instanced(geo, mat, pts, y, sc, layer) {
  if (!pts.length) return; const im = new THREE.InstancedMesh(geo, mat, pts.length), o = new THREE.Object3D();
  pts.forEach(([x, z], i) => { const s = sc * (0.85 + rnd() * 0.3); o.position.set(x, y * s + hillY(x, z), z); /* 언덕 위 나무는 한 단 위에 */ o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.castShadow = !layer; scene.add(layer ? toBg(im) : im);
}
const coneM = M(0x3f7a3a), ballM = M(0x5c9a45), trunkM = M(0x6b4a2e);
[0, BG].forEach(layer => {
  const pick = list => list.filter(([x, z]) => inNear(x, z) === !layer);
  instanced(treeCone, coneM, pick(trees.cone), 4.6, 1, layer); instanced(treeBall, ballM, pick(trees.ball), 2.9, 1, layer);
  instanced(trunkG, trunkM, pick(trees.cone.concat(trees.ball)), 0.8, 1, layer);
});
// 다니는 차: 봉화산로(양방향 4대) + 잔디광장 앞 길(2대)
const cars = [];
const CAR_COLORS = [0xffffff, 0x2a2d33, 0xd33b2c, 0xf2c230, 0x9aa4b0, 0x3b6fb6];
function makeCar(lane) {
  const g = new THREE.Group(), col = CAR_COLORS[cars.length % CAR_COLORS.length];
  box(4, 0.9, 1.8, col, 0, 0.7, 0, g); box(2.2, 0.7, 1.6, 0x26323d, -0.2, 1.45, 0, g);
  [-1.3, 1.3].forEach(x => [-0.85, 0.85].forEach(z => { const w = cyl(0.36, 0.36, 0.25, 0x15171a, 10); w.rotation.x = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); }));
  g.userData = lane; scene.add(g); cars.push(g); return g;
}
for (let i = 0; i < 4; i++) { const dir = i % 2 ? -1 : 1; makeCar({ axis: 'z', dir, lanePos: ROAD.south - dir * (i < 2 ? 1.2 : 3.2), pos: -60 + i * 30, v: 10 + i * 1.5, min: NEAR.z0, max: NEAR.z1 }); }
for (let i = 0; i < 2; i++) { const dir = i % 2 ? -1 : 1; makeCar({ axis: 'x', dir, lanePos: ROAD.east + dir * 0.9, pos: 0 + i * 20, v: 4 + i * 1.5, min: ROAD.south, max: ROAD.north - 3.5 }); }   // 차도 끝(앞마당)에서 되돌아감
function updateCars(dt) {
  cars.forEach(c => {
    const u = c.userData; u.pos += u.v * u.dir * dt;
    if (u.pos > u.max) u.pos = u.min; if (u.pos < u.min) u.pos = u.max;
    if (u.axis === 'x') { c.position.set(u.pos, 0, u.lanePos); c.rotation.y = u.dir > 0 ? 0 : Math.PI; }
    else { c.position.set(u.lanePos, 0, u.pos); c.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
  });
}

/* 공사 현장(펜스 안) + 동문 잔디광장(처음부터 있음) + 중앙광장(남쪽 안마당) */
const PAD = { x0: -17.5, x1: 17.5, z0: -23, z1: 6.8 };
flat(PAD.x1 - PAD.x0, PAD.z1 - PAD.z0, 0xb8956a, (PAD.x0 + PAD.x1) / 2, (PAD.z0 + PAD.z1) / 2, 0.01);
{ // 중앙광장: 격자·마름모 포장 + 봉화산로 쪽 계단 + 화단
  const w = R.E - R.A, d = C.c8 - C.c3, cx = (R.A + R.E) / 2, cz = (C.c3 + C.c8) / 2;
  const pave = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#b9b1a0'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, H); g.moveTo(0, i * 32); g.lineTo(W, i * 32); g.stroke(); }
    g.strokeStyle = '#9f9686'; g.lineWidth = 5; g.beginPath(); g.moveTo(W / 2, 20); g.lineTo(W - 20, H / 2); g.lineTo(W / 2, H - 20); g.lineTo(20, H / 2); g.closePath(); g.stroke();
    g.fillStyle = '#c6bca8'; g.beginPath(); g.arc(W / 2, H / 2, 26, 0, Math.PI * 2); g.fill();
  });
  pave.wrapS = pave.wrapT = THREE.RepeatWrapping; pave.repeat.set(2, 2);
  const p = flat(w, d, new THREE.MeshLambertMaterial({ map: pave }), cx, cz, 0.03);
  const sd = CZ(46.8) - CZ(23.4) - 0.4, sz = (CZ(46.8) + CZ(23.4)) / 2;   // 계단: 양쪽 계단실 사이만
  for (let s = 0; s < 3; s++) box(1.2, 0.15 * (s + 1), sd, 0xd0c9ba, R.A - 1.1 - (2 - s) * 1.2, 0.075 * (s + 1), sz, scene);
  [[R.A + 4.2, C.c3 + 1.4], [R.A + 4.2, C.c8 - 1.4], [R.E - 1.2, C.c3 + 1.4], [R.E - 1.2, C.c8 - 1.4]].forEach(([x, z]) => {
    box(1.8, 0.6, 1.8, 0xb7ad99, x, 0.3, z, scene); const t = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), M(0x5c9a45)); t.position.set(x, 1.3, z); t.castShadow = true; scene.add(t);
  });
}
// 동문 잔디광장: 현관 앞 가운데 보행로 + 양쪽 잔디 + 사선 산책로(사진·영상의 모양)
const plaza = new THREE.Group(); scene.add(plaza);
{
  const lawnM = M(0x86c24a), pathM = M(0xe2ddd0), z0 = PAD.z1 + 0.2, z1 = ROAD.east - 3.4, L = z1 - z0;
  const walkW = 2.6, xl = PAD.x0 + 0.5, xr = 14;   // 오른쪽 끝(북쪽)은 지하주차장 입구 자리
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(xr - xl + 1, L + 0.6), pathM); pave.rotation.x = -Math.PI / 2; pave.position.set((xl + xr) / 2, 0.025, (z0 + z1) / 2); pave.receiveShadow = true; plaza.add(pave);
  [[xl, XC - walkW / 2], [XC + walkW / 2, xr]].forEach(([a, b], s) => {
    const W = b - a, cx = (a + b) / 2;
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(W, L), lawnM);
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.03, (z0 + z1) / 2); lawn.receiveShadow = true; plaza.add(lawn);
    const sgn = s ? 1 : -1;
    [[z0 + L * 0.3, 1], [z0 + L * 0.68, -1]].forEach(([zz, a2]) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(W + 1, 0.6), pathM);
      p.rotation.x = -Math.PI / 2; p.rotation.z = sgn * a2 * 0.2; p.position.set(cx, 0.04, zz); p.receiveShadow = true; plaza.add(p);
    });
  });
  for (let x = xl + 1; x < xr; x += 4.2) if (Math.abs(x - XC) > 2) { const b = cyl(0.12, 0.12, 0.7, 0x2a2d33, 8); b.position.set(x, 0.35, z1 + 0.3); scene.add(b); }   // 볼라드
}
// 펜스(안전 가림막): 북쪽·서쪽만. 봉화산로(중앙광장)·잔디광장 쪽은 열어 둔다
// 완공(출범) 때 땅속으로 내려가며 사라진다(complete())
const fenceMat = M(0x2f6c9e), fence = new THREE.Group(); scene.add(fence);
box(0.2, 2, PAD.z1 - PAD.z0, fenceMat, PAD.x1, 1, (PAD.z0 + PAD.z1) / 2, fence);
box(PAD.x1 - PAD.x0, 2, 0.2, fenceMat, (PAD.x0 + PAD.x1) / 2, 1, PAD.z0, fence);
[[PAD.x0, PAD.z0, C.c3 - 0.5], [PAD.x0, C.c8 + 0.2, PAD.z1]].forEach(([x, z0, z1]) => box(0.2, 2, z1 - z0, fenceMat, x, 1, (z0 + z1) / 2, fence));   // 봉화산로 쪽은 안마당 앞만 비움
// 현장 안내판(봉화산로 쪽, 중앙광장 옆)
const signTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#0d1730'; g.fillRect(0, 0, w, h);
  for (let i = -2; i < 26; i++) { g.fillStyle = i % 2 ? '#ffc527' : '#0d1730'; g.beginPath(); g.moveTo(i * 24, 0); g.lineTo(i * 24 + 24, 0); g.lineTo(i * 24 + 4, 22); g.lineTo(i * 24 - 20, 22); g.fill(); }
  g.fillStyle = '#ffc527'; g.font = '700 30px "IBM Plex Sans KR", sans-serif'; g.fillText('공사 안내', 28, 70);
  g.fillStyle = '#fff'; g.font = '700 52px "Black Han Sans", "IBM Plex Sans KR", sans-serif'; g.fillText('중랑구청 신축공사', 28, 140);
  g.font = '500 28px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#c9d3e6'; g.fillText('발주: 중랑AX 2030 · 시공: 참석자 모두', 28, 196);
});
const sign = new THREE.Group();
box(6, 3, 0.15, new THREE.MeshLambertMaterial({ map: signTex }), 0, 2.6, 0, sign);
box(0.15, 1.2, 0.15, 0x555555, -2.6, 0.6, 0, sign); box(0.15, 1.2, 0.15, 0x555555, 2.6, 0.6, 0, sign);
sign.position.set(PAD.x0 - 0.4, 0, -17); sign.rotation.y = -Math.PI / 2 + 0.25; scene.add(sign);
for (let i = 0; i < 4; i++) box(2.6, 0.25, 0.9, 0xb98a52, -12, 0.15 + i * 0.27, -21 + (i % 2) * 0.1, scene);
const coneMat = M(0xff6a1a);
[[-16.5, -1.5], [-16.5, -12.5], [16.5, 4], [16.5, -6]].forEach(([x, z]) => { const c = cyl(0.05, 0.35, 0.9, coneMat, 8); c.position.set(x, 0.45, z); scene.add(c); });

/* ===== 건물: 회백색 석재 + 청록 사각 창 ===== */
const STONE = '#e7e4dd';
// kind: main(앞동 2~4층) · ground(앞동 1층 기둥 사이 긴 창) · tower(탑부 작은 창) · glass · entry(현관) · rear(뒷동 세로 창) · council/councilG(유리동)
function facade(kind, lit) {
  return canvasTex(128, 128, (g, w, h) => {
    const isC = kind === 'council' || kind === 'councilG';
    g.fillStyle = lit ? '#000' : STONE; g.fillRect(0, 0, w, h);
    if (!lit && !isC) { g.fillStyle = 'rgba(120,112,100,.16)'; for (let y = 32; y < h; y += 32) g.fillRect(0, y, w, 1); }
    const glass = (x, y, ww, hh, tone, cols, rows) => {
      if (lit) { g.fillStyle = '#ffd98a'; g.fillRect(x, y, ww, hh); return; }
      const gr = g.createLinearGradient(x, y, x + ww, y + hh), T = { teal: ['#164845', '#3f9088'], light: ['#7f9e9b', '#c6d8d4'], blue: ['#1d5f6e', '#4aa8b4'] }[tone];
      gr.addColorStop(0, T[0]); gr.addColorStop(1, T[1]); g.fillStyle = gr; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + 3, y + 3, Math.max(3, ww * 0.08), hh - 6);
      g.strokeStyle = '#2c4a46'; g.lineWidth = 3; g.strokeRect(x, y, ww, hh);
      g.lineWidth = 2; g.beginPath();
      for (let k = 1; k < cols; k++) { const xx = x + ww * k / cols; g.moveTo(xx, y); g.lineTo(xx, y + hh); }
      for (let k = 1; k < rows; k++) { const yy = y + hh * k / rows; g.moveTo(x, yy); g.lineTo(x + ww, yy); }
      g.stroke();
    };
    if (kind === 'main') glass(22, 14, 84, 94, 'teal', 2, 2);
    else if (kind === 'ground') {
      if (!lit) { g.fillStyle = '#d5d0c6'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(14, 0, 3, h); g.fillRect(w - 17, 0, 3, h); }
      glass(30, 14, 68, 102, 'light', 1, 6);
    } else if (kind === 'tower') { for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) glass(17 + c * 34, 22 + r * 46, 26, 30, 'teal', 1, 1); }
    else if (kind === 'glass') glass(4, 4, 120, 120, 'teal', 4, 3);
    else if (kind === 'entry') {
      glass(4, 4, 120, 120, 'teal', 4, 4);
      if (!lit) { g.fillStyle = '#1b2a2c'; g.fillRect(34, 66, 60, 58); g.strokeStyle = '#a7b4b2'; g.lineWidth = 2; g.strokeRect(34, 66, 60, 58); g.beginPath(); g.moveTo(64, 66); g.lineTo(64, 124); g.stroke(); }
    } else if (kind === 'rear') { glass(22, 22, 32, 80, 'teal', 1, 2); glass(74, 22, 32, 80, 'teal', 1, 2); }
    else if (kind === 'council') { if (!lit) { g.fillStyle = '#dfe3e2'; g.fillRect(0, 0, w, h); } glass(0, 18, 128, 88, 'blue', 4, 1); }
    else if (kind === 'councilG') {
      if (!lit) { g.fillStyle = '#f0b53a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e48a2a'; g.fillRect(0, 0, w, 14); }
      glass(14, 30, 100, 98, 'light', 3, 1);
    }
    if (!lit && kind !== 'entry' && kind !== 'glass') { g.fillStyle = 'rgba(150,143,130,.45)'; g.fillRect(0, h - 5, w, 5); }   // 층 띠
  });
}
const texCache = {};
function tex(kind, lit, rep) {
  const key = kind + (lit ? 1 : 0) + rep;
  if (!texCache[key]) { const t = facade(kind, lit); if (rep > 1) { t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1); } texCache[key] = t; }
  return texCache[key];
}
const WIN = { main: 1.3, ground: 1.3, rear: 1.3, tower: 2.6, entry: 2.6, glass: 2.6, council: 2.6, councilG: 2.6 };   // 창 한 장(타일)의 폭
function kindsOf(d) {   // [앞뒤 면(±z), 옆면(±x)]
  if (d.vol === 'WS') { const k = d.f === 0 ? 'councilG' : 'council'; return [k, k]; }
  if (d.vol === 'T') return [d.f === 0 ? 'entry' : d.f === 1 ? 'glass' : 'tower', 'tower'];
  if (d.vol === 'SS1' || d.vol === 'SS2' || d.vol === 'TW') return ['tower', 'tower'];
  if (d.vol === 'U') return [d.i === 3 ? 'tower' : 'rear', 'rear'];
  const k = d.f === 0 ? 'ground' : 'main'; return [k, k];
}
const topMat = M(0xcac6bd);
const site = new THREE.Group(); scene.add(site);
// 기초: 첫 등록 전부터 바닥에 깔린 콘크리트 기초 + 철근 격자(시연 영상의 첫 장면)
const rebarTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#b4b0a6'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#7d5b3c'; g.lineWidth = 2; g.beginPath();
  for (let i = 8; i < w; i += 16) { g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); } g.stroke();
});
rebarTex.wrapS = rebarTex.wrapT = THREE.RepeatWrapping;
Object.values(V).forEach(v => {
  const w = v.x1 - v.x0 + 0.6, d = v.z1 - v.z0 + 0.6, t = rebarTex.clone(); t.needsUpdate = true; t.repeat.set(w / 1.3, d / 1.3);
  const top = new THREE.MeshLambertMaterial({ map: t }), side = M(0x9a968c);
  box(w, BASE, d, [side, side, top, side, side, side], (v.x0 + v.x1) / 2, BASE / 2, (v.z0 + v.z1) / 2, site);
  [[v.x0, v.z0], [v.x1, v.z0], [v.x0, v.z1], [v.x1, v.z1]].forEach(([x, z]) => box(0.18, 1.2, 0.18, 0x7d5b3c, x, BASE + 0.6, z, site));   // 모서리 철근
});

// 비계(완성될 윤곽): 1~4층 고리 + 5~6층 가운데 막대
const ghostPts = [];
const ring = (x0, x1, y, z0, z1) => ghostPts.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
const ghostBox = (v, f0, f1) => {
  for (let f = f0; f <= f1; f++) ring(v.x0, v.x1, yAt(f), v.z0, v.z1);
  [[v.x0, v.z0], [v.x1, v.z0], [v.x0, v.z1], [v.x1, v.z1]].forEach(([x, z]) => ghostPts.push(x, yAt(f0), z, x, yAt(f1), z));
};
Object.values(V).forEach(v => ghostBox(v, 0, MAIN_FLOORS)); ghostBox(UPPER, MAIN_FLOORS, BAR_FLOORS);
const ghostGeo = new THREE.BufferGeometry(); ghostGeo.setAttribute('position', new THREE.Float32BufferAttribute(ghostPts, 3));
const ghostMat = new THREE.LineBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.55 });
const ghost = new THREE.LineSegments(ghostGeo, ghostMat); ghost.visible = false; site.add(ghost);   // 완성 윤곽선(노란 선)은 화면에 안 보이게

// 72칸
const blocks = DEFS.map(d => {
  const [fk, sk] = kindsOf(d), w = d.x1 - d.x0, dep = d.z1 - d.z0, h = FHS[d.f];
  const mat = (k, len) => { const rep = Math.max(1, Math.round(len / WIN[k])); return new THREE.MeshLambertMaterial({ map: tex(k, false, rep), emissive: 0x000000, emissiveMap: tex(k, true, rep) }); };
  const fm = mat(fk, w), sm = mat(sk, dep);
  const b = box(w - 0.03, h - 0.03, dep - 0.03, [sm, sm, topMat, topMat, fm, fm]);
  b.userData = { home: new THREE.Vector3((d.x0 + d.x1) / 2, yAt(d.f) + h / 2, (d.z0 + d.z1) / 2), mats: [fm, sm], floor: d.f + 1, h, d: dep, w, glow: 0.55 + Math.random() * 0.45 };
  b.visible = false; site.add(b); return b;
});

/* 마감(구청장 몫): 옥상 → 탑부 격자 프레임 → 옥탑(양 끝 둥근 드럼) → 중랑구 마크 → 옥상정원·안뜰 정원 → 현관 캐노피 → 현수막 → 슬로건 조형물 → 깃발 */
const crown = [], glowMats = [];
const piece = (g, home, extra) => { g.userData = Object.assign({ home }, extra || {}); crown.push(g); return g; };
const stoneM = M(0xe7e4dd), stoneD = M(0xcdc8be), slabM = M(0xb9bcc0);
{ // 옥상: 고리 지붕·난간, 가운데 막대 지붕, 설비
  const g = new THREE.Group();
  const roof = (v, y, wall) => {
    const w = v.x1 - v.x0, d = v.z1 - v.z0, cx = (v.x0 + v.x1) / 2, cz = (v.z0 + v.z1) / 2;
    box(w + 0.3, 0.3, d + 0.3, slabM, cx, y + 0.15, cz, g);
    if (!wall) return;
    [v.z0 - 0.05, v.z1 + 0.05].forEach(z => box(w + 0.4, 0.6, 0.2, stoneM, cx, y + 0.5, z, g));
    [v.x0 - 0.05, v.x1 + 0.05].forEach(x => box(0.2, 0.6, d + 0.4, stoneM, x, y + 0.5, cz, g));
  };
  ['ES', 'EN', 'NB', 'NK', 'WN', 'WS', 'SS1', 'SS2', 'TW'].forEach(k => roof(V[k], MAIN_TOP, true));
  roof(NK5, yAt(5), true);
  roof({ x0: V.T.x0, x1: V.T.x1, z0: C.c10, z1: V.T.z1 }, MAIN_TOP, false);
  roof(UPPER, TOP, true);
  box(2.2, 1.0, 1.6, 0xc9ccd0, XC, TOP + 0.8, -9.6, g);   // 가운데 막대 지붕 설비(4층 옥상은 정원이라 비움)
  piece(g, new THREE.Vector3(0, 0, 0));
}
{ // 격자 프레임: 가운데 동 5~7층 양 끝(6·7층 평면도의 모서리 상자) — 동쪽은 정면 사진처럼 앞으로 돌출, 서쪽도 같은 모양
  const g = new THREE.Group(), w = V.T.x1 - V.T.x0, y0 = MAIN_TOP - 0.6, yTop = TOP + 0.7;
  [[C.c10, ZF + 0.6, 1], [C.c1, C.c1 - 1.8, -1]].forEach(([z0, z1, s]) => {
    const zc = (z0 + z1) / 2, dz = Math.abs(z1 - z0);
    [-w / 2, w / 2].forEach(x => box(0.55, yTop - y0, dz, stoneM, XC + x, (yTop + y0) / 2, zc, g));
    [-w / 6, w / 6].forEach(x => box(0.35, TOP - MAIN_TOP, 0.5, stoneM, XC + x, (TOP + MAIN_TOP) / 2, z1 - 0.25 * s, g));
    [MAIN_TOP - 0.1, yAt(5), yTop].forEach(y => box(w + 0.55, 0.4, 0.7, stoneM, XC, y, z1 - 0.35 * s, g));
    [-w / 2, w / 2].forEach(x => box(0.45, 0.45, 3, stoneD, XC + x, yTop, z0 - 1.2 * s, g));
  });
  piece(g, new THREE.Vector3(0, 0, 0));
}
{ // 옥탑: 옥탑층 평면도처럼 양 끝이 둥근 긴 캡슐(동쪽 끝이 정면 사진의 '드럼'). 지붕은 초록 방수 도장 두 구역 + 가운데 승강기 기계실
  const g = new THREE.Group(), r = (UPPER.x1 - UPPER.x0) / 2 - 0.1, h = 2.6, zE = C.c10 - r + 0.7, zW = C.c1 + r - 0.3, green = M(0x5fae84), core = M(0xe9e6df);
  [zE, zW].forEach(z => {
    const c = cyl(r, r, h, stoneM, 40); c.position.set(0, h / 2, z); g.add(c);
    const b = cyl(r + 0.05, r + 0.05, 0.28, stoneD, 40); b.position.set(0, h - 0.25, z); g.add(b);
    const top = cyl(r - 0.25, r - 0.25, 0.08, green, 40); top.position.set(0, h + 0.04, z); g.add(top);
  });
  box(2 * r, h, zE - zW, stoneM, 0, h / 2, (zE + zW) / 2, g);
  box(2 * r + 0.1, 0.28, zE - zW, stoneD, 0, h - 0.25, (zE + zW) / 2, g);
  box(2 * r - 0.5, 0.08, zE - zW, green, 0, h + 0.04, (zE + zW) / 2, g);
  box(2 * r - 0.8, 1.2, 4.4, core, 0, h + 0.6, -7.6, g); box(2 * r - 0.5, 0.15, 4.7, stoneD, 0, h + 1.25, -7.6, g);   // 가운데 기계실(두 초록 구역 사이)
  piece(g, new THREE.Vector3(XC, TOP + 0.3, 0));
}
let bannerMat; const markMats = [];
// 중랑구 심볼(구름 선 + 주황 해 + 물결 세 줄)을 캔버스 선으로 그린다. 좌표는 608×640 기준
function drawJNSymbol(g, ox, oy, size) {
  const s = size / 640; g.save(); g.translate(ox, oy); g.scale(s, s);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 46; g.strokeStyle = '#1C7C38';
  const wave1 = () => { g.moveTo(560, 320); g.bezierCurveTo(470, 300, 380, 320, 300, 392); g.bezierCurveTo(240, 445, 160, 450, 110, 410); };
  g.save(); g.beginPath(); g.moveTo(222, 0); g.lineTo(608, 0); g.lineTo(608, 320); g.lineTo(560, 320); g.bezierCurveTo(470, 300, 380, 320, 300, 392); g.bezierCurveTo(270, 418, 245, 432, 222, 440); g.closePath(); g.clip();
  g.fillStyle = '#F18D00'; g.beginPath(); g.arc(292, 352, 72, 0, Math.PI * 2); g.fill(); g.restore();   // 해(물결 위로만)
  g.beginPath(); wave1();
  g.bezierCurveTo(50, 360, 60, 250, 150, 240); g.bezierCurveTo(170, 238, 185, 240, 198, 248);
  g.bezierCurveTo(195, 170, 250, 130, 300, 130); g.bezierCurveTo(360, 130, 405, 175, 405, 245);
  g.bezierCurveTo(470, 225, 545, 260, 552, 322); g.stroke();                                          // 구름 + 첫 물결
  g.beginPath(); g.moveTo(92, 530); g.bezierCurveTo(200, 560, 290, 500, 360, 452); g.bezierCurveTo(420, 412, 500, 398, 572, 406); g.stroke();
  g.beginPath(); g.moveTo(298, 600); g.bezierCurveTo(360, 556, 430, 498, 572, 492); g.stroke();
  g.restore();
}
const markMat = (tex) => { const m = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.3, emissive: 0x000000, emissiveMap: tex }); markMats.push(m); return m; };
{ // 중랑구 마크: 옥탑 동쪽 둥근 면(정면·남동쪽에서 크게 보임) + 남쪽 벽 봉화산로 모서리(심볼 + '중랑구')
  const g = new THREE.Group();
  const symTex = canvasTex(256, 256, (c, w, h) => drawJNSymbol(c, 12, 4, 240));
  const r = (UPPER.x1 - UPPER.x0) / 2 - 0.1 + 0.03, hh = 1.8, len = 1.8 / r;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh, 16, 1, true, -len / 2, len), markMat(symTex));
  drum.position.set(XC, TOP + 0.3 + 1.25, C.c10 - (r - 0.03) + 0.7); drum.userData.noShadow = true; g.add(drum);
  const logoTex = canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect ? c.roundRect(4, 4, w - 8, h - 8, 18) : c.rect(4, 4, w - 8, h - 8); c.fill();
    drawJNSymbol(c, 26, 14, 132);
    c.fillStyle = '#040000'; c.font = '700 92px "IBM Plex Sans KR", "Malgun Gothic", sans-serif'; c.textBaseline = 'middle'; c.fillText('중랑구', 186, h / 2 + 4);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.375), markMat(logoTex));
  plate.rotation.y = -Math.PI / 2; plate.position.set(R.A - 0.05, yAt(3) + 0.8, (C.c8 + C.c10) / 2); plate.userData.noShadow = true; g.add(plate);
  piece(g, new THREE.Vector3(0, 0, 0));
}
{ // 정원: 동쪽 날개(남) 옥상정원 + 북쪽 안뜰(1층 위 옥상정원) + 서쪽 날개 옥상
  const g = new THREE.Group(), trunk = M(0x6b4a2e), leaves = [M(0x3f8a3a), M(0x2f7432), M(0x5aa047)], soil = M(0x6f8f4a), red = M(0xc8553d);
  const yR = MAIN_TOP + 0.3, yC = BASE + FHS[0];   // 옥상 높이, 안뜰 정원 높이(1층 지붕)
  box(R.K - R.H, FHS[0], C.c8 - C.c3, stoneM, (R.H + R.K) / 2, BASE + FHS[0] / 2, (C.c3 + C.c8) / 2, g);   // 안뜰 1층
  box(R.K - R.H - 0.4, 0.3, C.c8 - C.c3 - 0.4, soil, (R.H + R.K) / 2, yC + 0.15, (C.c3 + C.c8) / 2, g);
  box(R.E - R.A - 1, 0.3, C.c10 - C.c8 - 1.2, soil, (R.A + R.E) / 2, yR + 0.15, (C.c8 + C.c10) / 2 - 0.3, g);
  box(R.E - R.A - 1, 0.3, C.c3 - C.c1 - 1, soil, (R.A + R.E) / 2, yR + 0.15, (C.c1 + C.c3) / 2, g);
  box(3, 0.32, 1.2, red, -11, yR + 0.17, 0.4, g); box(2.4, 0.32, 1.2, red, 5, yC + 0.17, -4, g);
  const tree = (x, y, z, s, i) => {
    const tr = cyl(0.12, 0.16, 0.9 * s, trunk, 6); tr.position.set(x, y + 0.45 * s, z); g.add(tr);
    [[0, 1.3, 0, 0.85], [0.45, 1.05, 0.3, 0.6], [-0.4, 1.1, -0.25, 0.6]].forEach(([dx, dy, dz, r], k) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r * s, 8, 6), leaves[(i + k) % 3]); m.position.set(x + dx * s, y + dy * s, z + dz * s); g.add(m);
    });
  };
  [[-13, 0.6], [-11.2, 2.6], [-9, 0.2], [-7, 2.4], [-5.2, 0.8]].forEach(([x, z], i) => tree(x, yR + 0.3, z, 0.85 + (i % 3) * 0.12, i));
  [[2.6, -11.5], [5, -9.4], [7.6, -11.8], [3, -6.5], [7.8, -6.8], [5.4, -2.6], [2.8, -2.4], [8, -2.2]].forEach(([x, z], i) => tree(x, yC + 0.3, z, 0.9 + (i % 3) * 0.15, i + 1));
  [[-12.6, -16.4], [-9.4, -17.6], [-6, -16]].forEach(([x, z], i) => tree(x, yR + 0.3, z, 0.8, i + 2));
  // 뒤쪽 4층 옥상(동쪽 날개 북, 북쪽 띠·코어, 서쪽 날개 북)도 모두 옥상정원 — 가운데 막대가 올라가는 자리는 비움
  const flowers = [red, M(0xe8b830), M(0xd96aa7)];
  const roofGarden = (x0, x1, z0, z1, seed) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(w - 0.8, 0.3, d - 0.8, soil, cx, yR + 0.15, cz, g);
    const long = w >= d, n = Math.max(1, Math.round((long ? w : d) / 2.6));
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, x = long ? x0 + w * u : cx + (k % 2 ? 0.6 : -0.6) * Math.min(1, w / 4), z = long ? cz + (k % 2 ? 0.6 : -0.6) * Math.min(1, d / 4) : z0 + d * u;
      if ((k + seed) % 3 === 2) box(1.4, 0.32, 0.9, flowers[(k + seed) % 3], x, yR + 0.17, z, g);
      else tree(x, yR + 0.3, z, 0.7 + ((k * 7 + seed) % 4) * 0.08, k + seed);
    }
  };
  roofGarden(R.H + 0.3, R.L, C.c8, C.c10, 1); roofGarden(R.L, R.M, C.c2, C.c9, 2); roofGarden(R.K, R.L, NK5.z1 + 0.2, C.c8, 3);   // 5층 남은 방(NK5) 자리는 비움
  roofGarden(R.H + 0.3, R.L, C.c1, C.c3, 4);
  piece(g, new THREE.Vector3(0, 0, 0));
}
{ // 현관 캐노피(캔틸레버)
  const g = new THREE.Group(), w = V.T.x1 - V.T.x0 + 1;
  box(w, 0.22, 2.6, 0xeef0f2, 0, 0, 1.3, g);
  box(w, 0.32, 0.12, slabM, 0, 0, 2.6, g);
  [-w / 2 + 0.4, w / 2 - 0.4].forEach(x => { const rod = box(0.06, 0.06, 3.1, 0x8b9099, x, 0.8, 1.25, g); rod.rotation.x = 0.55; });
  piece(g, new THREE.Vector3(XC, BASE + 1.95, ZF));
}
{ // 중앙광장 쪽(가운데 동 남쪽 면) 출입구: 유리문 + 작은 캐노피 — 전경 사진에서 안마당 정면 가운데
  const g = new THREE.Group(), zc = (C.c3 + C.c8) / 2;
  box(0.12, 2.0, 4.2, 0x2c4a46, -0.06, 1.0, 0, g); box(0.14, 1.6, 3.6, 0x3f9088, -0.08, 0.9, 0, g);
  box(2.2, 0.2, 5.2, 0xeef0f2, -1.1, 2.25, 0, g);
  piece(g, new THREE.Vector3(R.E, BASE, zc));
}
{ // 현수막: 탑부 3~4층 앞
  const tx = canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1C7C38'; g.fillRect(0, 0, w, 10); g.fillStyle = '#F18D00'; g.fillRect(0, h - 10, w, 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#0d1730'; g.font = '400 58px "Black Han Sans", "IBM Plex Sans KR", sans-serif'; g.fillText('중랑AX 2030', w / 2, 88);
    g.font = '700 32px "IBM Plex Sans KR", sans-serif'; g.fillText('제1차 전략포럼', w / 2, 154);
    g.font = '400 50px "Black Han Sans", "IBM Plex Sans KR", sans-serif';
    const parts = [['나의 자랑 ', '#106A3A'], ['우리 ', '#9E1C84'], ['중랑', '#0057A3']];
    const total = parts.reduce((s, [t]) => s + g.measureText(t).width, 0); let x = (w - total) / 2;
    g.textAlign = 'left'; parts.forEach(([t, c]) => { g.fillStyle = c; g.fillText(t, x, 236); x += g.measureText(t).width; });
  });
  const g = new THREE.Group(), hgt = MAIN_TOP - yAt(2) - 0.4;
  bannerMat = new THREE.MeshLambertMaterial({ map: tx, emissive: 0x000000, emissiveMap: tx });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, hgt), bannerMat); m.userData.noShadow = true; g.add(m);
  piece(g, new THREE.Vector3(XC, (yAt(2) + MAIN_TOP) / 2 - 0.1, ZF + 0.05));
}
{ // 슬로건 조형물 '나의 자랑 [심볼] 우리 중랑': 잔디광장 봉화산로 쪽 끝, 큰길을 보게(사진 1~3).
  // 흰 앞면 + 색 옆면 입체 글자(같은 글자판을 여러 장 겹쳐 두께) + 유리판 받침. 실물(글자 약 1.2m)보다 3배쯤 크게.
  // 구청장 확인 뒤 글자가 한 덩어리씩 땅에서 솟아오름(placeFast의 rise)
  const g = new THREE.Group(), parts = [], Hl = 1.2, base = 0.3, LAYERS = 6, DEPTH = 0.06;
  const words = [['나의', '#1f8a4c'], ['자랑', '#a3237f'], [null, '#8f99a6'], ['우리', '#1e9b7f'], ['중랑', '#1a6fd0']];
  const FONT = '400 200px "Black Han Sans", "IBM Plex Sans KR", sans-serif';
  const meas = document.createElement('canvas').getContext('2d'); meas.font = FONT;
  const symTint = (c, col, sz) => {   // 중랑 심볼을 한 색으로
    const t = document.createElement('canvas'); t.width = t.height = sz; const tc = t.getContext('2d');
    drawJNSymbol(tc, sz * 0.06, sz * 0.03, sz * 0.9); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = col; tc.fillRect(0, 0, sz, sz);
    c.drawImage(t, 0, 0);
  };
  const tex = (txt, cw, front, col) => canvasTex(cw, 256, (c, w, h) => {
    if (txt === null) { symTint(c, front ? '#ffffff' : col, 256); return; }
    c.font = FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (front) { c.lineWidth = 8; c.strokeStyle = '#c3c9d1'; c.strokeText(txt, w / 2, h / 2 + 6); c.fillStyle = '#ffffff'; }
    else { c.lineWidth = 8; c.strokeStyle = col; c.strokeText(txt, w / 2, h / 2 + 6); c.fillStyle = col; }
    c.fillText(txt, w / 2, h / 2 + 6);
  });
  const sizes = words.map(([t]) => t === null ? 256 : Math.ceil(meas.measureText(t).width + 24));
  const gap = 0.3, widths = sizes.map(s => Hl * s / 256), total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  const zc = (PAD.z1 + ROAD.east - 3.4) / 2; let z = zc - total / 2;
  words.forEach(([t, col], i) => {
    const pg = new THREE.Group(), w = widths[i], fm = markMat(tex(t, sizes[i], true, col)), sm = new THREE.MeshLambertMaterial({ map: tex(t, sizes[i], false, col), transparent: true, alphaTest: 0.3 });
    for (let k = LAYERS; k >= 0; k--) {   // 뒤(+x)부터 색 판, 맨 앞(-x)이 흰 판
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, Hl), k ? sm : fm); m.rotation.y = -Math.PI / 2; m.position.x = k * DEPTH; m.userData.noShadow = true; pg.add(m);
    }
    const y = base + Hl / 2; pg.position.set(0, y, z + w / 2); g.add(pg); parts.push({ g: pg, y });
    z += w + gap;
  });
  const glass = new THREE.MeshLambertMaterial({ color: 0xbfe3ea, transparent: true, opacity: 0.35 });
  const gb = box(0.1, 0.62, total + 0.5, glass, LAYERS * DEPTH / 2, 0.31, zc, g); gb.userData.noShadow = true;
  box(0.2, 0.06, total + 0.5, 0x8b9099, LAYERS * DEPTH / 2, 0.03, zc, g);
  piece(g, new THREE.Vector3(-15.6, 0, 0), { rise: parts });   // 잔디 큰길 쪽 가장자리(굴착기 자리 -12.5보다 앞)
}
{ // 깃발 3개(슬로건 3색) — 잔디광장 오른쪽 앞
  const g = new THREE.Group(), flags = [];
  [[7.4, 0x106A3A], [9.7, 0x9E1C84], [12, 0x0057A3]].forEach(([x, col]) => {
    const pole = cyl(0.07, 0.09, 8, 0xe3e6ea, 8); pole.position.set(x, 4, 0); g.add(pole);
    const fg = new THREE.Group(); fg.position.set(x, 7.2, 0); g.add(fg);
    box(2.0, 1.3, 0.04, col, -1.05, 0, 0, fg); flags.push(fg);
  });
  piece(g, new THREE.Vector3(0, 0, 18.6), { flags });
}
crown.forEach(c => { c.visible = false; c.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noShadow; o.receiveShadow = true; } }); site.add(c); });
const ALL_STEPS = TOTAL + crown.length;

/* ===== 타워크레인 ===== */
const yel = M(0xf2b705), dark = M(0x2a2f38);
const tmpV = new THREE.Vector3();
const cranes = [];
function makeCrane(x, z, H, startRot) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(1.1, H, 1.1, yel, 0, H / 2, 0, g);
  const lattice = []; for (let y = 0; y < H; y += 1.1) lattice.push(-0.56, y, 0.56, 0.56, y + 1.1, 0.56, 0.56, y, -0.56, -0.56, y + 1.1, -0.56, 0.56, y, 0.56, 0.56, y + 1.1, -0.56, -0.56, y, -0.56, -0.56, y + 1.1, 0.56);
  const latG = new THREE.BufferGeometry(); latG.setAttribute('position', new THREE.Float32BufferAttribute(lattice, 3));
  g.add(new THREE.LineSegments(latG, new THREE.LineBasicMaterial({ color: 0x6b5200 })));
  box(3, 0.8, 3, 0x7a8088, 0, 0.4, 0, g);
  const jib = new THREE.Group(); jib.position.y = H + 0.4; jib.rotation.y = startRot || 0; g.add(jib);
  box(37, 0.7, 0.8, yel, 12.5, 0, 0, jib);
  box(1.6, 1.4, 1.4, 0xe9edf1, 0.4, -1, 0.9, jib);   // 조종실
  box(3, 1.4, 1.4, 0x6c727a, -4.6, -0.2, 0, jib);   // 평형추
  box(0.6, 3.4, 0.6, yel, 0, 2, 0, jib);
  const ties = new THREE.BufferGeometry(); ties.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.6, 0, 30, 0.3, 0, 0, 3.6, 0, -6, 0.3, 0], 3));
  jib.add(new THREE.LineSegments(ties, new THREE.LineBasicMaterial({ color: 0x333333 })));
  const trolley = box(1, 0.5, 1, dark, 15, -0.5, 0, jib);
  const hook = box(0.5, 0.6, 0.5, 0xd33b2c, 0, 0, 0); scene.add(hook);
  const cableGeo = new THREE.BufferGeometry(); cableGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const cable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: 0x222222 })); scene.add(cable);
  const c = { g, jib, trolley, hook, cable, cableGeo, H, carried: null, busy: false, ready: true };
  cranes.push(c); return c;
}
function updateCable(c) {
  c.trolley.getWorldPosition(tmpV);
  const p = c.cableGeo.attributes.position;
  let endY;
  if (c.carried) { endY = c.carried.position.y + c.carried.userData.h / 2 + 0.4; c.hook.position.set(tmpV.x, endY + 0.3, tmpV.z); }
  else { endY = tmpV.y - 6; c.hook.position.set(tmpV.x, endY - 0.3, tmpV.z); }
  p.setXYZ(0, tmpV.x, tmpV.y, tmpV.z); p.setXYZ(1, tmpV.x, endY, tmpV.z); p.needsUpdate = true;
}
const crane1 = makeCrane(5.2, -21, 23, 1.2);   // 서쪽 뒤편
// 2호기: 부구청장 도착 때 땅에서 솟아오름
const crane2 = makeCrane(-9.1, -7.2, 21, Math.PI - 0.4);   // 남쪽 안마당
crane2.ready = false; crane2.g.visible = false; crane2.hook.visible = false; crane2.cable.visible = false;

/* ===== 애니메이션 도구 ===== */
const tweens = [];
function tween(dur, fn, done) { if (REDUCED) dur = Math.min(dur, 0.12); tweens.push({ t: 0, dur, fn, done }); }
const ease = { out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, in: k => k * k, back: k => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2) };

const bursts = [];
function burst(pos, { n = 18, color = 0xcbb89a, speed = 3, life = 0.9, size = 0.45, gravity = 2, additive = false, ring = false } = {}) {
  if (bursts.length > 90 && n < 10) return;   // 불꽃이 많을 때 잔가루는 생략(성능)
  const g = new THREE.BufferGeometry(), arr = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) {
    arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z;
    const a = ring ? (i / n) * Math.PI * 2 : Math.random() * Math.PI * 2, e = ring ? 0 : additive ? (Math.random() - .5) * Math.PI : Math.random() * 0.6, s = ring ? speed : speed * (0.5 + Math.random() * 0.6);
    v.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + (additive ? 0 : 0.5), Math.sin(a) * Math.cos(e) * s));
  }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 1, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const p = new THREE.Points(g, m); scene.add(p);
  bursts.push({ p, v, age: 0, life, gravity });
}

/* ===== 칸 올리기 ===== */
let placed = 0;
function land(b) {
  const h = b.userData.home;
  tween(0.25, k => { b.scale.set(1 + 0.05 * Math.sin(k * Math.PI), 1 - 0.08 * Math.sin(k * Math.PI), 1); }, () => b.scale.set(1, 1, 1));
  burst(new THREE.Vector3(h.x, h.y - b.userData.h / 2, h.z + b.userData.d / 2), { n: 14 });
}
function placeByCrane(i, c, done) {
  const b = blocks[i], h = b.userData.home, jib = c.jib, trolley = c.trolley;
  const dx = h.x - c.g.position.x, dz = h.z - c.g.position.z;
  const th = Math.atan2(-dz, dx), r = Math.hypot(dx, dz);
  const th0 = jib.rotation.y, r0 = trolley.position.x;
  let d = th - th0; d = Math.atan2(Math.sin(d), Math.cos(d));
  tween(0.55, k => { const e = ease.inOut(k); jib.rotation.y = th0 + d * e; trolley.position.x = r0 + (r - r0) * e; }, () => {
    const topY = c.H - 2.5;
    b.visible = true; b.position.set(h.x, topY, h.z); c.carried = b;
    tween(0.85, k => { b.position.y = topY + (h.y - topY) * ease.inOut(k); b.rotation.y = Math.sin(k * Math.PI) * 0.06; }, () => {
      b.position.copy(h); b.rotation.y = 0; c.carried = null; land(b); done && done();
    });
  });
}
// 1층: 기초 위에 기둥 4개 → 위 보(테두리) → 벽을 아래부터 차곡차곡 쌓음 → 거푸집(기둥·보) 걷어냄
const frameM = M(0x8f8b82), rebarM = M(0x7d5b3c);
function growInPlace(i, done) {
  const b = blocks[i], h = b.userData.home, H = b.userData.h, W = b.userData.w, D = b.userData.d, y0 = h.y - H / 2;
  const g = new THREE.Group(); g.position.set(h.x, y0, h.z); scene.add(g);
  const cx = W / 2 - 0.13, cz = D / 2 - 0.13;
  const cols = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
    const c = box(0.26, H, 0.26, frameM, sx * cx, H / 2, sz * cz, g);
    box(0.06, 0.7, 0.06, rebarM, sx * cx, H + 0.35, sz * cz, c.parent);   // 기둥 위로 삐죽 나온 철근
    c.scale.y = 0.01; c.position.y = 0; return c;
  });
  const bars = g.children.filter(o => !cols.includes(o)); bars.forEach(o => o.visible = false);
  burst(new THREE.Vector3(h.x, y0, h.z), { n: 10, speed: 2 });
  tween(0.55, k => cols.forEach((c, n) => { const s = Math.max(0.01, ease.out(Math.min(1, k * 1.3 - n * 0.1))); c.scale.y = s; c.position.y = H * s / 2; }), () => {
    cols.forEach(c => { c.scale.y = 1; c.position.y = H / 2; }); bars.forEach(o => o.visible = true);
    const beams = [[W, 0.2, 0.22, 0, cz], [W, 0.2, 0.22, 0, -cz], [0.22, 0.2, D, cx, 0], [0.22, 0.2, D, -cx, 0]].map(([w, hh, d, x, z]) => box(w, hh, d, frameM, x, H - 0.1, z, g));
    beams.forEach(bm => bm.scale.set(0.01, 1, 0.01));
    tween(0.35, k => beams.forEach((bm, n) => { const s = Math.max(0.01, k); if (n < 2) bm.scale.x = s; else bm.scale.z = s; }), () => {
      b.visible = true; b.position.copy(h); b.scale.set(0.97, 0.02, 0.97);
      tween(0.9, k => { const s = Math.max(0.02, k); b.scale.y = s; b.position.y = y0 + H * s / 2; }, () => {   // 벽: 아래부터 일정한 속도로
        b.scale.set(1, 1, 1); b.position.copy(h); scene.remove(g); land(b); done && done();
      });
    });
  });
}
// 헬기: 칸을 줄에 매달고 날아와 위에서 내려놓는다(2층 이상)
const heli = (() => {
  const g = new THREE.Group(), red = M(0xd33b2c), white = M(0xf4f6f8);
  box(3.2, 1.4, 1.5, red, 0, 0, 0, g); box(3.22, 0.28, 1.52, white, 0, -0.25, 0, g);
  box(1.1, 1.05, 1.3, 0x9fd3ff, 1.75, 0.12, 0, g);
  box(3.6, 0.35, 0.35, red, -3.2, 0.3, 0, g); box(0.6, 1.1, 0.12, white, -4.9, 0.8, 0, g);
  const tail = new THREE.Group(); tail.position.set(-4.9, 0.9, 0.2); g.add(tail); box(1.2, 0.12, 0.05, dark, 0, 0, 0, tail); box(0.12, 1.2, 0.05, dark, 0, 0, 0, tail);
  const mast = cyl(0.1, 0.1, 0.5, dark, 6); mast.position.y = 0.95; g.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 1.22; g.add(rotor); box(9, 0.06, 0.32, dark, 0, 0, 0, rotor); box(0.32, 0.06, 9, dark, 0, 0, 0, rotor);
  [-0.65, 0.65].forEach(z => { box(3.2, 0.1, 0.12, dark, 0.1, -1.15, z, g); [-0.8, 0.9].forEach(x => box(0.08, 0.5, 0.08, dark, x, -0.9, z, g)); });
  const PARK = new THREE.Vector3(-30, 42, 92);
  g.position.copy(PARK); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x222222 })); line.visible = false; scene.add(line);
  return { kind: 'heli', g, rotor, tail, line, lineGeo, PARK, ready: true, busy: false, carried: null, atPark: true, idleAt: 0 };
})();
const HANG = 4.2;
function faceTo(g, from, to) { g.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x); }
function placeByHeli(i, done) {
  const b = blocks[i], h = b.userData.home, hv = heli, H = b.userData.h;
  const hover = new THREE.Vector3(h.x, Math.max(h.y + HANG + 4, TOP + 5), h.z), start = hv.g.position.clone();
  hv.atPark = false; b.visible = true; hv.carried = b; faceTo(hv.g, start, hover);
  const hangY = () => hv.g.position.y - 1.2 - HANG - H / 2;
  tween(start.distanceTo(hover) > 25 ? 1.8 : 1.1, k => {
    hv.g.position.lerpVectors(start, hover, ease.inOut(k)); hv.g.rotation.z = -Math.sin(k * Math.PI) * 0.22;
    b.position.set(hv.g.position.x, hangY(), hv.g.position.z); b.rotation.y = Math.sin(k * 6) * 0.05;
  }, () => {
    const y0 = b.position.y; hv.g.rotation.z = 0;
    tween(0.9, k => { b.position.y = y0 + (h.y - y0) * ease.inOut(k); }, () => {
      b.position.copy(h); b.rotation.y = 0; hv.carried = null; hv.idleAt = t; land(b); done && done();
    });
  });
}
function updateHeli(dt, now) {
  const hv = heli; hv.rotor.rotation.y += dt * 28; hv.tail.rotation.z += dt * 40;
  const p = hv.lineGeo.attributes.position;
  if (hv.carried) { p.setXYZ(0, hv.g.position.x, hv.g.position.y - 1.2, hv.g.position.z); p.setXYZ(1, hv.carried.position.x, hv.carried.position.y + hv.carried.userData.h / 2, hv.carried.position.z); p.needsUpdate = true; hv.line.visible = true; }
  else hv.line.visible = false;
  if (!hv.busy && !hv.atPark && !hv.leaving && now - hv.idleAt > 4) {   // 4초 동안 일이 없으면 돌아간다
    hv.leaving = true; hv.busy = true; const s = hv.g.position.clone(); faceTo(hv.g, s, hv.PARK);
    tween(2, k => { hv.g.position.lerpVectors(s, hv.PARK, ease.inOut(k)); hv.g.rotation.z = -Math.sin(k * Math.PI) * 0.2; }, () => { hv.leaving = false; hv.busy = false; hv.atPark = true; pump(); });
  }
  if (!hv.carried && !hv.leaving) hv.g.position.y += Math.sin(now * 2.2) * 0.004;   // 제자리 비행
}
// 사다리차: 잔디광장 앞에 서서 사다리를 펴고, 칸을 사다리 위로 올려 2~4층 정면 칸에 밀어 넣는다
const ladder = (() => {
  const g = new THREE.Group(), body = M(0xf2a516), white = M(0xf4f6f8);
  box(5.6, 0.9, 2.1, 0x2d3138, 0, 0.75, 0, g); box(3.8, 0.9, 2.1, body, -0.7, 1.6, 0, g);
  box(1.5, 1.6, 2.1, white, 2.3, 1.6, 0, g); box(0.05, 0.7, 1.8, 0x24384f, 3.06, 1.9, 0, g);
  [-1.9, -0.7, 1.9].forEach(x => [-0.9, 0.9].forEach(z => { const w = cyl(0.42, 0.42, 0.3, 0x1d1f24, 12); w.rotation.x = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); }));
  [[-2.4, -1.3], [-2.4, 1.3], [1.2, -1.3], [1.2, 1.3]].forEach(([x, z]) => box(0.18, 0.7, 0.18, 0x3b3f46, x, 0.35, z, g));   // 받침다리
  const turret = new THREE.Group(); turret.position.set(-1.6, 2.15, 0); g.add(turret); box(1.1, 0.4, 1.1, 0x2d3138, 0, 0, 0, turret);
  const boom = new THREE.Group(); boom.position.y = 0.3; turret.add(boom);
  const lt = canvasTex(32, 64, (c, w, h) => { c.fillStyle = '#e8b830'; c.fillRect(0, 0, 6, h); c.fillRect(w - 6, 0, 6, h); for (let y = 6; y < h; y += 16) c.fillRect(0, y, w, 4); });
  lt.wrapT = THREE.RepeatWrapping;
  const lad = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1), new THREE.MeshLambertMaterial({ map: lt, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  lad.rotation.x = -Math.PI / 2; boom.add(lad);
  const rails = [-0.38, 0.38].map(x => box(0.07, 0.14, 1, 0xd99a12, x, 0, 0, boom));
  const plat = box(1.3, 0.12, 1.3, 0x8b9099, 0, -0.05, 0, boom);
  function setBoom(L, th) {
    boom.rotation.x = th; lad.scale.y = L; lad.position.z = -L / 2; lt.repeat.set(1, L * 1.6);
    rails.forEach(r => { r.scale.z = L; r.position.z = -L / 2; }); plat.position.z = -L;
  }
  setBoom(2.5, 0);
  g.position.set(XC + 1.6, 0, Z0 + 5.1); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  return { kind: 'ladder', g, setBoom, ready: true, busy: false };
})();
function placeByLadder(i, done) {
  const lt = ladder, b = blocks[i], h = b.userData.home, H = b.userData.h, D = b.userData.d;
  const x0 = lt.g.position.x, x1 = Math.max(-14, Math.min(14.5, h.x + 1.6));
  tween(Math.min(1.4, 0.3 + Math.abs(x1 - x0) * 0.07), k => { lt.g.position.x = x0 + (x1 - x0) * ease.inOut(k); }, () => {
    const P = new THREE.Vector3(x1 - 1.6, 2.45, lt.g.position.z), A = new THREE.Vector3(h.x, h.y + 0.12, h.z + D + 0.3);   // A: 칸 자리 바로 앞
    const tipY = A.y - H / 2 - 0.08, dz = P.z - A.z, dy = tipY - P.y, L = Math.hypot(dz, dy), th = Math.atan2(dy, dz);
    tween(0.6, k => lt.setBoom(2.5 + (L - 2.5) * ease.out(k), th * ease.out(k)), () => {
      b.visible = true;
      tween(1.2, k => { const e = ease.inOut(k); b.position.set(h.x, P.y + 0.08 + H / 2 + dy * e, P.z - dz * e); }, () => {
        const s = b.position.clone();
        tween(0.45, k => b.position.lerpVectors(s, h, ease.inOut(k)), () => {
          b.position.copy(h); land(b);
          tween(0.5, k => lt.setBoom(L + (2.5 - L) * k, th * (1 - k)), () => done && done());
        });
      });
    });
  });
}
// 운반 수단 고르기: 1층은 땅에서(세 조), 2층부터 타워크레인·헬기(세 번에 한 번꼴), 2~4층 정면 칸은 가끔 사다리차
const groundCrews = [0, 1, 2].map(() => ({ kind: 'ground', ready: true, busy: false }));
let liftNo = 0, ladderNo = 0;
function pickCarrier() {
  const d = placed < TOTAL ? DEFS[placed] : null, f = d ? d.f : -1;
  if (f === 0) return groundCrews.find(c => !c.busy) || null;
  if (d && f <= 3 && ['ES', 'EN', 'T'].includes(d.vol) && d.z1 === V[d.vol].z1 && !ladder.busy && ladderNo++ % 3 === 0) return ladder;
  const freeCranes = cranes.filter(c => c.ready && !c.busy), heliFree = !heli.busy;
  if (f > 0 && heliFree && (liftNo % 3 === 2 || !freeCranes.length)) { liftNo++; return heli; }
  if (freeCranes.length) { liftNo++; return freeCranes[0]; }
  return f < 0 ? (heliFree ? heli : null) : null;
}
function placeCell(i, c, done) { if (c.kind === 'ground') growInPlace(i, done); else if (c.kind === 'heli') placeByHeli(i, done); else if (c.kind === 'ladder') placeByLadder(i, done); else placeByCrane(i, c, done); }
function placeFast(obj, delay, done) {
  const h = obj.userData.home;
  if (obj.userData.rise) {   // 슬로건 조형물: 자리에 두고 글자 덩어리가 하나씩 땅에서 솟아오름
    const parts = obj.userData.rise, step = REDUCED ? 0 : 280;
    setTimeout(() => {
      parts.forEach(p => { p.g.position.y = p.y - 2.2; });
      obj.visible = true; obj.position.copy(h);
      parts.forEach((p, i) => setTimeout(() => {
        const wp = new THREE.Vector3(); p.g.getWorldPosition(wp); wp.y = 0.2; burst(wp, { n: 12, color: 0x8a6a45, speed: 2.4 });
        tween(0.55, k => { p.g.position.y = p.y - 2.2 * (1 - ease.back(k)); }, () => { p.g.position.y = p.y; if (i === parts.length - 1) done && done(); });
      }, i * step));
    }, REDUCED ? 0 : delay);
    return;
  }
  setTimeout(() => {
    obj.visible = true; obj.position.set(h.x, h.y + 16, h.z);
    tween(0.6, k => { obj.position.y = h.y + 16 * (1 - ease.in(k)); }, () => { obj.position.copy(h); if (obj.userData.floor) land(obj); else burst(h.clone(), { n: 24, speed: 4 }); done && done(); });
  }, REDUCED ? 0 : delay);
}

/* ===== 인부 ===== */
const workers = [];
const SKIN = [0xe8b98f, 0xd9a274, 0xf0c9a2];
const VEST = [0xff7a1a, 0xf2c230, 0x3aa0ff, 0x39b56a];
function randPoint() {
  for (;;) {
    const x = PAD.x0 + 1 + Math.random() * (PAD.x1 - PAD.x0 - 2), z = PAD.z0 + 1 + Math.random() * (PAD.z1 - PAD.z0 - 2);
    if (inBuilding(x, z)) continue;
    if (Math.hypot(x - 5.2, z + 21) < 3 || Math.hypot(x + 9.1, z + 7.2) < 2.6) continue;
    if (Math.abs(x + 2) < 3.8 && Math.abs(z + 21) < 2.4) continue;
    return new THREE.Vector3(x, 0, z);
  }
}
function inBuilding(x, z) { return Object.values(V).some(v => x > v.x0 - 0.8 && x < v.x1 + 0.8 && z > v.z0 - 0.8 && z < v.z1 + 0.8); }
function clearPath(a, b) { for (let s = 1; s <= 10; s++) { const x = a.x + (b.x - a.x) * s / 10, z = a.z + (b.z - a.z) * s / 10; if (inBuilding(x, z)) return false; } return true; }
function nextPoint(from) { for (let i = 0; i < 50; i++) { const p = randPoint(); if (p.distanceTo(from) < 15 && clearPath(from, p)) return p; } return randPoint(); }
function makeWorker(special) {
  const g = new THREE.Group();
  const legs = [-0.11, 0.11].map(x => { const L = new THREE.Group(); L.position.set(x, 0.58, 0); box(0.16, 0.56, 0.18, 0x34405a, 0, -0.28, 0, L); g.add(L); return L; });
  const body = cyl(0.21, 0.24, 0.62, special ? 0xffffff : VEST[Math.random() * VEST.length | 0], 10); body.position.y = 0.9; g.add(body);
  box(0.46, 0.08, 0.46, 0xe8f0f8, 0, 0.95, 0, g).scale.set(1, 1, 1);
  const arms = [-0.29, 0.29].map(x => { const A = new THREE.Group(); A.position.set(x, 1.15, 0); box(0.12, 0.5, 0.14, body.material, 0, -0.25, 0, A); g.add(A); return A; });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), M(SKIN[Math.random() * 3 | 0])); head.position.y = 1.36; head.castShadow = true; g.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(special ? 0xffffff : 0xffc527)); hat.position.y = 1.4; hat.castShadow = true; g.add(hat);
  box(0.44, 0.03, 0.44, hat.material, 0, 1.4, 0.04, g);
  g.scale.setScalar(1.25);
  g.position.set((Math.random() - .5) * 4, 0, 24);
  g.userData = { legs, arms, target: new THREE.Vector3(g.position.x, 0, 15), pause: 0, ph: Math.random() * 10, jump: 0, speed: 2.4 + Math.random() * 0.8 };
  scene.add(g); workers.push(g);
}
function updateWorkers(dt, t) {
  workers.forEach(w => {
    const u = w.userData;
    if (u.jump > 0) {
      u.jump -= dt; w.position.y = Math.abs(Math.sin(u.jump * 9)) * 0.7;
      u.arms.forEach(a => a.rotation.x = Math.PI);   // 만세
      return;
    }
    w.position.y = 0;
    if (u.pause > 0) {
      u.pause -= dt;
      u.arms[1].rotation.x = -1.2 + Math.sin(t * 9 + u.ph) * 0.6;   // 망치질
      u.arms[0].rotation.x = 0; u.legs.forEach(l => l.rotation.x = 0);
      if (u.pause <= 0) u.target = nextPoint(w.position);
      return;
    }
    const d = tmpV.subVectors(u.target, w.position); d.y = 0; const dist = d.length();
    if (dist < 0.2) { u.pause = 1 + Math.random() * 3; return; }
    d.normalize(); w.position.addScaledVector(d, Math.min(dist, u.speed * dt));
    w.rotation.y = Math.atan2(d.x, d.z);
    const s = Math.sin(t * 10 + u.ph) * 0.6;
    u.legs[0].rotation.x = s; u.legs[1].rotation.x = -s; u.arms[0].rotation.x = -s * 0.8; u.arms[1].rotation.x = s * 0.8;
  });
}
function cheerAll() { workers.forEach((w, i) => { setTimeout(() => { w.userData.jump = 1.6; }, i * 40); }); }

/* ===== 장비 ===== */
function wheels(g, xs, z, r = 0.45) { xs.forEach(x => [-z, z].forEach(zz => { const w = cyl(r, r, 0.35, 0x1d1f24, 14); w.rotation.x = Math.PI / 2; w.position.set(x, r, zz); g.add(w); })); }
const MACHINES = {
  excavator: { name: '굴착기', spot: [-12.5, 14.5], face: 0.6, make() {
    const g = new THREE.Group();
    box(3.2, 0.7, 0.7, 0x2a2d33, 0, 0.35, -0.85, g); box(3.2, 0.7, 0.7, 0x2a2d33, 0, 0.35, 0.85, g);
    const top = new THREE.Group(); top.position.y = 0.75; g.add(top);
    box(2.4, 0.8, 2, 0xf2b705, -0.3, 0.4, 0, top);
    box(1.2, 1.3, 1, 0xf2b705, 0.2, 1.3, 0.45, top); box(0.9, 0.9, 0.05, 0x24384f, 0.25, 1.45, 0.96, top);
    const boom = new THREE.Group(); boom.position.set(0.9, 0.9, -0.3); top.add(boom);
    box(3, 0.4, 0.4, 0xf2b705, 1.5, 0, 0, boom); boom.rotation.z = 0.5;
    const stick = new THREE.Group(); stick.position.set(3, 0, 0); boom.add(stick);
    box(0.35, 2.2, 0.35, 0xf2b705, 0, -1.1, 0, stick);
    box(0.9, 0.7, 0.9, 0x3b3f46, 0.3, -2.3, 0, stick);
    return { g, update(t) { top.rotation.y = Math.sin(t * 0.5) * 0.7; boom.rotation.z = 0.35 + Math.sin(t * 1.3) * 0.25; stick.rotation.z = -0.4 + Math.sin(t * 1.3 + 1) * 0.35; } };
  } },
  mixer: { name: '레미콘', spot: [-7, 14], face: Math.PI / 2, make() {
    const g = new THREE.Group();
    box(5, 0.5, 1.9, 0x2d3138, 0, 0.9, 0, g); wheels(g, [-1.8, -0.8, 1.7], 0.85);
    box(1.4, 1.5, 1.9, 0xf4f6f8, 1.9, 1.9, 0, g); box(0.05, 0.7, 1.6, 0x24384f, 2.62, 2.2, 0, g);
    const drumTex = canvasTex(64, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ff7a1a' : '#f4f6f8'; c.fillRect(0, i * 8, w, 8); } });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 2.8, 16), new THREE.MeshLambertMaterial({ map: drumTex }));
    drum.castShadow = true; drum.rotation.z = Math.PI / 2 + 0.2; drum.position.set(-0.6, 2.05, 0); g.add(drum);
    return { g, update(t, dt) { drum.rotation.y += dt * 2.4; } };
  } },
  dump: { name: '덤프트럭', spot: [11.5, 14.5], face: -Math.PI / 2, make() {
    const g = new THREE.Group();
    box(5, 0.5, 2, 0x2d3138, 0, 0.9, 0, g); wheels(g, [-1.8, -0.9, 1.8], 0.9, 0.5);
    box(1.4, 1.6, 2, 0xd33b2c, 1.95, 1.95, 0, g); box(0.05, 0.7, 1.7, 0x24384f, 2.67, 2.3, 0, g);
    const bed = new THREE.Group(); bed.position.set(-2.4, 1.2, 0); g.add(bed);
    box(3.4, 1.1, 2, 0xd33b2c, 1.7, 0.55, 0, bed); box(3.0, 0.4, 1.6, 0x8b6b45, 1.7, 1.15, 0, bed);
    return { g, update(t) { const s = Math.max(0, Math.sin(t * 0.4)); bed.rotation.z = -s * 0.7; } };
  } },
  pump: { name: '펌프카', spot: [5.5, 13.6], face: Math.PI, make() {
    const g = new THREE.Group();
    box(5.4, 0.6, 2, 0x2d3138, 0, 0.95, 0, g); wheels(g, [-1.9, -0.9, 1.9], 0.9, 0.5);
    box(1.4, 1.6, 2, 0xf4f6f8, 2.2, 2, 0, g); box(4, 0.7, 1.8, 0xf4f6f8, -0.7, 1.6, 0, g);
    const b1 = new THREE.Group(); b1.position.set(-1.6, 2.1, 0); g.add(b1);
    box(5, 0.35, 0.35, 0xd33b2c, 2.5, 0, 0, b1);
    const b2 = new THREE.Group(); b2.position.set(5, 0, 0); b1.add(b2); box(4.2, 0.3, 0.3, 0xf4f6f8, 2.1, 0, 0, b2);
    const b3 = new THREE.Group(); b3.position.set(4.2, 0, 0); b2.add(b3); box(3.2, 0.25, 0.25, 0xd33b2c, 1.6, 0, 0, b3);
    const hose = cyl(0.12, 0.12, 2, 0x222222, 6); hose.position.set(3.2, -1, 0); b3.add(hose);
    return { g, update(t) { b1.rotation.z = 0.9 + Math.sin(t * 0.3) * 0.08; b2.rotation.z = -1.3 + Math.sin(t * 0.4) * 0.1; b3.rotation.z = -0.8 + Math.sin(t * 0.5) * 0.1; hose.rotation.z = -(b1.rotation.z + b2.rotation.z + b3.rotation.z); } };
  } },
  forklift: { name: '지게차', spot: [-3.6, 17.6], face: 0, make() {
    const g = new THREE.Group();
    box(2, 0.9, 1.4, 0xff8a1a, 0, 0.8, 0, g); wheels(g, [-0.65, 0.65], 0.65, 0.35);
    box(0.9, 1.2, 1.2, 0x2a2d33, -0.3, 1.85, 0, g);
    box(0.12, 2.8, 0.12, 0x3b3f46, 1.05, 1.4, -0.45, g); box(0.12, 2.8, 0.12, 0x3b3f46, 1.05, 1.4, 0.45, g);
    const fork = new THREE.Group(); g.add(fork);
    box(1.2, 0.08, 0.15, 0x777777, 1.65, 0, -0.35, fork); box(1.2, 0.08, 0.15, 0x777777, 1.65, 0, 0.35, fork);
    box(1.1, 0.5, 1.1, 0xb98a52, 1.7, 0.3, 0, fork);
    return { g, update(t) { fork.position.y = 0.3 + (Math.sin(t * 0.8) + 1) * 0.8; } };
  } },
  roller: { name: '롤러', spot: [3.5, 18.4], face: 0, make() {
    const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
    const drum = cyl(0.75, 0.75, 1.9, 0x8b9099, 18); drum.rotation.x = Math.PI / 2; drum.position.set(1.2, 0.75, 0); inner.add(drum);
    box(2.2, 1, 1.6, 0xf2b705, -0.5, 1.1, 0, inner); box(1, 1, 1.2, 0x2a2d33, -0.7, 2.1, 0, inner);
    wheels(inner, [-1.2], 0.7, 0.5);
    return { g, update(t) { inner.position.x = Math.sin(t * 0.35) * 5; drum.rotation.y = 0; drum.rotation.z = -inner.position.x / 0.75; } };
  } }
};
MACHINES.mobile = { name: '크레인차', spot: [-15.9, -19], face: Math.PI / 2, make() {
  const g = new THREE.Group();
  box(5.4, 0.6, 2, 0x2d3138, 0, 0.95, 0, g); wheels(g, [-1.9, -0.6, 0.6, 1.9], 0.9, 0.5);
  box(1.4, 1.5, 2, 0xf2b705, 2.2, 1.95, 0, g);
  const turret = new THREE.Group(); turret.position.set(-0.8, 1.4, 0); g.add(turret);
  box(2.2, 1, 1.8, 0xf2b705, 0, 0.5, 0, turret);
  const boom = new THREE.Group(); boom.position.set(0.6, 1, 0); turret.add(boom);
  box(7, 0.5, 0.5, 0xf2b705, 3.5, 0, 0, boom); box(4, 0.35, 0.35, 0xe8a400, 8.5, 0, 0, boom);
  const line = cyl(0.04, 0.04, 4, 0x222222, 4); line.position.set(10.4, -2, 0); boom.add(line);
  return { g, update(t) { turret.rotation.y = Math.sin(t * 0.25) * 0.5; boom.rotation.z = 0.75 + Math.sin(t * 0.4) * 0.08; line.rotation.z = -boom.rotation.z; } };
} };
const ORDER = ['excavator', 'mixer', 'dump', 'pump', 'forklift', 'roller', 'mobile'];

// 현장사무소(발제자)
function makeOffice() {
  const g = new THREE.Group();
  box(6, 2.6, 2.5, 0x2f6c9e, 0, 1.3, 0, g);
  box(1.6, 1, 0.05, 0xbfe0ff, -1.6, 1.6, 1.26, g); box(1.6, 1, 0.05, 0xbfe0ff, 1.6, 1.6, 1.26, g); box(0.9, 1.9, 0.05, 0xe9edf1, 0, 0.95, 1.26, g);
  const tex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#ffc527'; c.fillRect(0, 0, w, h); c.fillStyle = '#0d1730'; c.font = '700 34px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('현장사무소', w / 2, h / 2 + 2); });
  box(3, 0.6, 0.06, new THREE.MeshLambertMaterial({ map: tex }), 0, 2.95, 1.2, g);
  const bp = canvasTex(128, 96, (c, w, h) => { c.fillStyle = '#1d4f9a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#cfe3ff'; c.lineWidth = 2; c.strokeRect(14, 14, 100, 68); for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(14, 14 + i * 13.6); c.lineTo(114, 14 + i * 13.6); c.stroke(); } for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(14 + i * 16.6, 14); c.lineTo(14 + i * 16.6, 82); c.stroke(); } });
  const board = box(2.2, 1.6, 0.06, new THREE.MeshLambertMaterial({ map: bp }), 4.2, 0.95, 1, g); board.rotation.x = -0.2;
  g.userData.home = new THREE.Vector3(-2, 0, -21); g.rotation.y = 0;
  return g;
}
// 투광등(토론 패널)
const LIGHT_SPOTS = [[-17.2, 6], [17.2, 6], [-17.2, -22.2], [17.2, -22.2], [10, -22.4]];
const lamps = [];
function makeLight(x, z) {
  const g = new THREE.Group();
  box(1.6, 0.6, 1, 0xf2b705, 0, 0.5, 0, g);
  const pole = cyl(0.1, 0.12, 7, 0x8b9099, 8); pole.position.y = 4.3; g.add(pole);
  const lm = new THREE.MeshLambertMaterial({ color: 0xfff4cc, emissive: 0x665c3a });
  const head = new THREE.Group(); head.position.y = 7.9; g.add(head);
  [-0.55, 0.55].forEach(dx => [0, 0.65].forEach(dy => box(0.5, 0.5, 0.25, lm, dx, dy, 0, head)));
  head.lookAt(new THREE.Vector3(-x, 4, -z).add(new THREE.Vector3(0, 0, 0)));
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 16, 20, 1, true), beamMat);
  beam.rotation.x = -Math.PI / 2; beam.position.z = 8; head.add(beam);
  g.userData.home = new THREE.Vector3(x, 0, z);
  lamps.push({ lm, beamMat, head, base: head.rotation.clone() });
  return g;
}
const extras = { office: null, lights: 0 };
// instant = 이어 그리기(restore): 연출 없이 바로 제자리에
function dropIn(obj, instant) {
  obj.visible = false; obj.traverse(o => { if (o.isMesh && o.material.type !== 'MeshBasicMaterial') { o.castShadow = true; o.receiveShadow = true; } }); scene.add(obj);
  if (instant) { obj.visible = true; obj.position.copy(obj.userData.home); } else placeFast(obj, 0);
}
function addOffice(instant) { if (extras.office) return false; extras.office = makeOffice(); dropIn(extras.office, instant); return true; }
function addLight(instant) { if (extras.lights >= LIGHT_SPOTS.length) return 0; const [x, z] = LIGHT_SPOTS[extras.lights++]; const g = makeLight(x, z); dropIn(g, instant); return extras.lights; }
function raiseCrane2(instant) {
  if (crane2.ready || crane2.raising) return false;
  if (instant) { crane2.ready = true; crane2.g.visible = true; crane2.g.scale.set(1, 1, 1); crane2.hook.visible = true; crane2.cable.visible = true; return true; }
  crane2.raising = true; crane2.g.visible = true; crane2.g.scale.set(1, 0.02, 1);
  burst(crane2.g.position.clone().setY(0.3), { n: 30, speed: 4 });
  tween(2.6, k => crane2.g.scale.set(1, 0.02 + 0.98 * ease.out(k), 1), () => {
    crane2.ready = true; crane2.hook.visible = true; crane2.cable.visible = true; setTimeout(pump, 100);
  });
  return true;
}
const deployed = [];
function deployNext(instant) {
  const key = ORDER.find(k => !deployed.some(d => d.key === k)); if (!key) return null;
  const def = MACHINES[key], m = def.make();
  m.g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const [sx, sz] = def.spot;
  if (instant) { m.g.position.set(sx, 0, sz); m.g.rotation.y = def.face; scene.add(m.g); deployed.push({ key, m, ready: true }); return def.name; }
  m.g.position.set(sx > 0 ? 40 : -40, 0, 23); m.g.rotation.y = sx > 0 ? Math.PI : 0; scene.add(m.g);
  const rec = { key, m, ready: false }; deployed.push(rec);
  const from = m.g.position.clone(), mid = new THREE.Vector3(sx, 0, 23), to = new THREE.Vector3(sx, 0, sz);
  tween(2.2, k => { m.g.position.lerpVectors(from, mid, ease.out(k)); }, () => {
    m.g.rotation.y = Math.PI / 2 * (sz < 23 ? -1 : 1) + Math.PI;
    tween(1.6, k => { m.g.position.lerpVectors(mid, to, ease.inOut(k)); if (k > 0.85) m.g.rotation.y += (def.face - m.g.rotation.y) * 0.2; }, () => { m.g.rotation.y = def.face; rec.ready = true; burst(to.clone().setY(0.3), { n: 20, speed: 3.5 }); });
  });
  return def.name;
}

/* ===== 카메라 ===== */
const CAM_AZ = -1.1;                     // 남남동쪽 위에서 내려다봄(중앙광장 쪽 면이 잘 보이게)
let camR = 76, camH = 35, lookY = 4;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); if (rendererBg) rendererBg.setSize(w, h, false); camera.aspect = w / h;
  if (w > 900) camera.setViewOffset(w, h, 0, -h * 0.04, w, h); else camera.clearViewOffset();   // 구청이 화면 가운데
  camR = w < 600 ? 112 : 76;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ===== 화면 글자 ===== */
const state = { count: 0, key: 0, bonus: 0, mayor: false, done: false };
const fmtTime = at => { const d = at ? new Date(at) : new Date(); return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(isNaN(d) ? new Date() : d); };
let shownPct = 0, countTw = 0;
function hud() {
  // 큰 노란 숫자 = 참석 인원(공정률 숫자는 화면에 안 씀, 막대로만 진행 정도를 보여 줌)
  const pct = Math.round(Math.min(placed, ALL_STEPS) / ALL_STEPS * 100);
  $('barFill').style.width = pct + '%';
  // 숫자 올라가는 애니메이션은 늘 마지막 것 하나만(한꺼번에 여러 명이 오면 예전 애니메이션이 늦게 덮어써 숫자가 멈추던 문제).
  // 목표 숫자가 바뀔 때만 새로 시작(칸이 올라갈 때마다 hud()가 불려 애니메이션이 계속 처음으로 돌아가 숫자가 멈추던 문제)
  const to = state.count;
  if (to !== shownPct) {
    const from = +$('nCount').textContent || 0, id = ++countTw; shownPct = to;
    tween(0.6, k => { if (id === countTw) $('nCount').textContent = Math.round(from + (to - from) * k); });
  }
  $('nWorkers').textContent = workers.length;
  $('nMachines').textContent = deployed.length + cranes.filter(c => c.ready || c.raising).length;   // 타워크레인 포함
  $('nKey').textContent = state.key;
  const ph = $('phase'); ph.classList.remove('wait');
  // 어느 동·몇 층을 짓는지는 적지 않는다
  if (state.done) ph.textContent = '중랑AX 2030 출범';
  else if (state.mayor) ph.textContent = '구청장님 도착 · 마감 공사';
  else if (placed >= TOTAL) { ph.textContent = '마감 대기 · 구청장님을 기다립니다'; ph.classList.add('wait'); }
  else ph.textContent = placed === 0 ? '첫 등록을 기다립니다' : '함께 짓는 중';
}
// 일지 한 줄: [시각] [소속(길면 …)] [이름(안 자름)] [꼬리표]
function logLine(text, extra, vip, at, dept) {
  const ol = $('logList'); const e = ol.querySelector('.empty'); if (e) e.remove();
  const li = document.createElement('li'); if (vip) li.className = 'key';
  li.innerHTML = `<time></time><span><i></i><b></b></span><em></em>`;
  li.children[0].textContent = fmtTime(at);
  const s = li.children[1]; s.children[0].textContent = dept || ''; s.children[0].hidden = !dept; s.children[1].textContent = text;
  if (dept) s.title = `${dept} ${text}`;
  li.children[2].textContent = extra || '';
  ol.prepend(li); while (ol.children.length > 6) ol.lastChild.remove();
}
/* 도착 알림: 사람마다 흰 팝업 카드 한 장이 화면 여기저기(안내판·일지·시연 도구를 피한 빈자리)에서 톡 튀어나옴.
   보통 7초·중요 관계자 9초. 동시에 큰 화면 6장(좁은 화면 3장)까지 — 넘치면 오래된 것부터 사라짐.
   구청장 도착(center)은 위 가운데 */
const TOAST_MS = { normal: 7000, key: 9000 };
const AVATAR = ['#106A3A', '#9E1C84', '#0057A3'];   // 중랑 슬로건 3색
let lastSpot = null;
function toast({ who = '', dept = '', name = '', rank = '', what = '', key = false, sir = true, mark = '', center = false }) {
  const box = $('toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'pop' + (key ? ' key' : '');
  el.innerHTML = '<div class="card"><span class="av"></span><div class="tx"><span class="who"></span><span class="dept"></span><span class="name"><b></b><small></small></span></div><span class="what"></span></div>';
  const [av, w, d, n, wh] = el.querySelectorAll('.av,.who,.dept,.name,.what');
  const first = mark || Array.from(name.trim())[0] || '★';
  let h = 0; for (const ch of name + dept) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  av.textContent = first; el.style.setProperty('--c', key ? '#F18D00' : AVATAR[h % 3]);
  w.textContent = who; w.hidden = !who;
  d.textContent = dept; d.hidden = !dept; d.title = dept;
  n.children[0].textContent = name; n.children[1].textContent = sir ? (rank ? rank + '님' : '님') : '';
  wh.textContent = what; wh.hidden = !what;
  el.style.setProperty('--r', ((Math.random() * 4 - 2) * (center ? 0 : 1)).toFixed(2) + 'deg');
  el.style.visibility = 'hidden';
  const live = [...box.children].filter(c => !c.classList.contains('out'));
  for (const old of live.slice(0, Math.max(0, live.length - ((innerWidth <= 900 ? 3 : 6) - 1)))) dropToast(old);
  box.append(el);
  spotPop(el, live.filter(c => !c.classList.contains('out')), center);
  el.style.visibility = '';
  setTimeout(() => dropToast(el), key ? TOAST_MS.key : TOAST_MS.normal);
}
// 빈자리 찾기: 무작위 후보 중 안내판·다른 팝업과 안 겹치고, 바로 앞 팝업과 멀리 떨어진 곳
function spotPop(el, others, center) {
  const W = innerWidth, H = innerHeight, m = 16, w = el.offsetWidth, h = el.offsetHeight;
  const pad = 14, blocks = [];
  for (const id of ['brand', 'meter', 'log', 'demo', 'finale', 'netState']) {   // netState = 연결 상태·빨간 열쇠 안내(index.html)
    const b = $(id); if (!b || (id === 'finale' && !b.classList.contains('show'))) continue;   // 숨은 것은 크기 0이라 아래에서 빠짐
    const r = b.getBoundingClientRect(); if (r.width && r.height) blocks.push(r);
  }
  for (const o of others) if (o._r) blocks.push(o._r);
  const over = (x, y) => {
    let s = 0;
    for (const r of blocks) {
      const ox = Math.min(x + w + pad, r.right) - Math.max(x - pad, r.left), oy = Math.min(y + h + pad, r.bottom) - Math.max(y - pad, r.top);
      if (ox > 0 && oy > 0) s += ox * oy;
    }
    return s;
  };
  const maxX = Math.max(m, W - w - m), maxY = Math.max(m, H - h - m);
  let best = null;
  const tryAt = (x, y, near = true) => {
    const far = lastSpot && near ? Math.hypot(x - lastSpot.x, y - lastSpot.y) : W;
    const score = over(x, y) * 4 + Math.max(0, W * 0.3 - far) * 40;
    if (!best || score < best.s) best = { x, y, s: score };
  };
  if (center) tryAt((W - w) / 2, m + 4, false);   // 구청장: 가운데 위가 비어 있으면 거기
  if (!best || best.s > 0) for (let i = 0; i < 70; i++) tryAt(m + Math.random() * (maxX - m), m + Math.random() * (maxY - m));
  const x = Math.round(Math.min(maxX, Math.max(m, best.x))), y = Math.round(Math.min(maxY, Math.max(m, best.y)));
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el._r = { left: x, top: y, right: x + w, bottom: y + h };
  lastSpot = { x, y };
}
function dropToast(el) { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 450); }

/* ===== 도착 처리 ===== */
// 중요 관계자: 직책마다 현장에 들어오는 것이 다르다
const ROLE_LABEL = { council: '구의원', director: '국장', deputy: '부구청장', speaker: '발제자', panel: '토론 패널' };
const queue = [];
// 참석 1명 = 칸 PER_PERSON개. 알림·숫자는 등록 즉시(크레인이 바빠도 이름이 늦게 뜨지 않게), 칸은 줄 세워 운반 수단이 비는 대로 올린다
function arrive(p) {
  if (state.done || !p) return;
  if (state.mayor) {   // 마감·출범 중 들어온 사람: 칸·장비는 없이 알림·숫자·일지만
    state.count++; if (p.role) state.key++;
    toast({ who: p.role ? (ROLE_LABEL[p.role] || '') : '', dept: p.dept || '', name: p.name || ROLE_LABEL[p.role] || '참석자', rank: p.name ? (p.rank || '') : '', what: '함께 출범을 축하합니다', key: !!p.role });
    logLine(...logParts(p), '등록', !!p.role, p.at, logDept(p)); hud(); return;
  }
  announce(p);
  for (let k = 0; k < PER_PERSON; k++) queue.push({ part: k });
  pump();
}
function pump() {
  if (state.mayor) return;
  while (queue.length) {
    const c = pickCarrier(); if (!c) return;
    queue.shift(); place(c);
  }
}
function addWorkers(n, special) { for (let i = 0; i < n; i++) makeWorker(special); }
// 일지: 중요 관계자는 "구의원 홍길동", 일반은 소속(따로, 길면 …) + 이름(없으면 직위)
const logParts = p => [p.role ? `${ROLE_LABEL[p.role] || ''} ${p.name || ''}`.trim() : (p.name || p.rank || '참석자')];
const logDept = p => p.role ? '' : (p.dept || '');
// 중요 관계자 보상 → [알림 문구, 일지 꼬리표]. 일반 참석자는 null. instant = 연출 없이 바로(이어 그리기)
function reward(p, instant) {
  const helpers = n => { state.bonus += n; addWorkers(n, true); return [`인부 ${n}명 합류`, `인부 +${n}`]; };
  if (p.role === 'council') return helpers(2);
  if (p.role === 'director') { const m = deployNext(instant); return m ? [`${m} 투입`, m] : helpers(3); }
  if (p.role === 'deputy') return raiseCrane2(instant) ? ['타워크레인 2호기 설치 · 시공 속도 2배', '크레인 2호기'] : helpers(3);
  if (p.role === 'speaker') return addOffice(instant) ? ['현장사무소 개설 · 설계도 확정', '현장사무소'] : helpers(2);
  if (p.role === 'panel') { const n = addLight(instant); return n ? [`투광등 ${n}호 설치`, `투광등 ${n}호`] : helpers(2); }
  return null;
}
function fillCrew() {   // 3명당 인부 1명(+보상 인부), 최대 40명. 새로 들어온 일반 인부 수를 돌려줌
  const target = Math.min(40, 3 + Math.floor(state.count / 3) + state.bonus);
  let crew = 0; while (workers.length < target) { makeWorker(false); crew++; }
  return crew;
}
function announce(p) {
  state.count++;
  const key = !!p.role;
  if (key) state.key++;
  const roleName = ROLE_LABEL[p.role] || '';
  const building = placed + queue.length < TOTAL;   // 아직 올릴 칸이 남았나(줄 선 칸 포함)
  const parts = [building ? '구청 한 칸 시공' : '마감 자재 준비'];   // 실제로는 2칸이지만 문구는 '한 칸'(사용자 결정 2026-11-15)
  let extra = building ? '시공' : '자재';
  const r = reward(p, false);
  if (r) { parts.push(r[0]); extra = r[1]; }
  if (fillCrew() && !key) parts.push('인부 1명 합류');

  // 동명이인은 소속으로만 구별 → 소속과 이름을 늘 같이. 직위는 비어 있을 수 있음(직접 입력)
  toast({ who: key ? roleName : '', /* 이름 위 노란 표시: 직책만 */ dept: p.dept || '', name: p.name || roleName || '참석자', rank: p.name ? (p.rank || '') : '', what: parts.join(' · '), key });
  logLine(...logParts(p), extra, key, p.at, logDept(p));
  if (key) cheerAll();
  hud();
}
function place(c) {
  c.busy = true;
  const next = () => { c.busy = false; hud(); setTimeout(pump, queue.length > 6 ? 60 : 250); };
  if (placed < TOTAL) { const i = placed++; hud(); placeCell(i, c, next); }
  else setTimeout(next, 600);   // 칸을 다 지었으면 마감 자재만 쌓아 둔다
}

function mayorArrive() {
  if (state.mayor) return;
  state.mayor = true;
  // 줄 서 있던 등록은 애니메이션 없이 숫자에만 반영
  queue.splice(0);   // 줄 서 있던 칸은 아래에서 남은 칸과 함께 한꺼번에(사람은 이미 등록 때 셈)
  state.count++;
  toast({ name: '구청장님 도착', sir: false, what: '마감 공사를 시작합니다', key: true, mark: '★', center: true });
  logLine('구청장님 도착', '출범', true);
  cheerAll();
  for (let i = 0; i < 6; i++) makeWorker(true);
  while (deployNext()) {}
  hud();
  // 남은 칸을 한꺼번에
  const rest = []; for (let i = placed; i < TOTAL; i++) rest.push(i);
  const waitCrane = cranes.some(c => c.busy) || heli.carried ? 1700 : 400;
  while (addLight()) {}
  addOffice();
  setTimeout(() => {
    cranes.forEach((c, n) => tween(1.2, k => { c.jib.rotation.y += ((n ? 0.4 : 2.6) - c.jib.rotation.y) * k * 0.15; c.trolley.position.x += (6 - c.trolley.position.x) * k * 0.1; }));
    const gap = Math.min(110, 6000 / Math.max(1, rest.length));   // 남은 칸이 많아도 6초 안에
    rest.forEach((idx, n) => placeFast(blocks[idx], n * gap, () => { placed++; hud(); }));
    const tCrown = rest.length * gap + 900;
    crown.forEach((c, n) => placeFast(c, tCrown + n * 450, () => { placed++; hud(); if (n === crown.length - 1) setTimeout(complete, 600); }));
  }, waitCrane);
}

/* ===== 이어 그리기(새로고침·프로젝터 재접속) =====
   restore({ people: [{ name, dept, rank, role, at? }], mayor, mayorAt? }) — 첫 arrive 전에 한 번만.
   people은 등록 순서대로(오래된 것 먼저). 구청장은 명단에 넣지 않고 mayor: true로(숫자에 1명 더해짐, mayorArrive와 같음).
   칸·인부·장비·크레인 2호기·사무소·투광등을 연출 없이 그 상태로, 알림 카드 없이. 일지는 마지막 6줄. */
let restored = false;
function restore(opts) {
  const { people = [], mayor = false, mayorAt } = opts || {};
  if (restored || state.count || placed || queue.length || state.mayor) return false;
  restored = true;
  const tags = people.map((p, i) => {
    state.count++; if (p.role) state.key++;
    const r = reward(p, true);
    return r ? r[1] : (i * PER_PERSON < TOTAL ? '시공' : '자재');
  });
  fillCrew();
  const n = mayor ? TOTAL : Math.min(TOTAL, people.length * PER_PERSON);
  for (let i = 0; i < n; i++) { const b = blocks[i]; b.visible = true; b.position.copy(b.userData.home); }
  placed = n;
  const lines = people.map((p, i) => [...logParts(p), tags[i], !!p.role, p.at, logDept(p)]);
  if (mayor) {
    state.mayor = true; state.count++;
    for (let i = 0; i < 6; i++) makeWorker(true);
    while (deployNext(true)) {}
    while (addLight(true)) {}
    addOffice(true);
    crown.forEach(c => { c.visible = true; c.position.copy(c.userData.home); });
    lines.push(['구청장님 도착', '출범', true, mayorAt]);
  }
  lines.slice(-6).forEach(l => logLine(...l));
  workers.forEach(w => { w.position.copy(randPoint()); w.userData.target = nextPoint(w.position); });   // 정문에서 걸어 들어오지 않게 현장 곳곳에
  // 숫자·막대는 바로 맞춤(올라가는 애니메이션 없이)
  const bar = $('barFill'); bar.style.transition = 'none';
  shownPct = state.count; countTw++; $('nCount').textContent = state.count;
  if (mayor) complete(true); else hud();
  void bar.offsetWidth; bar.style.transition = '';
  return true;
}

/* ===== 출범 축하: 꼬리 달린 폭죽(구·고리·잔불) + 꽃가루 + 탐조등 + 화면 섬광 ===== */
const CELEB = [0xffc527, 0xff6b6b, 0x4dabf7, 0x51cf66, 0xc77dff, 0xffffff, 0x1C7C38, 0xF18D00, 0x9E1C84, 0x0057A3];
const pickC = () => CELEB[Math.random() * CELEB.length | 0];
const rockets = [], rocketGeo = new THREE.SphereGeometry(0.28, 6, 4);
function launch(delay) {
  setTimeout(() => {
    const head = new THREE.Mesh(rocketGeo, new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
    head.position.set(-20 + Math.random() * 40, 1, -24 + Math.random() * 36); scene.add(head);
    rockets.push({ head, col: pickC(), apex: TOP + 5 + Math.random() * 9, vy: 18 + Math.random() * 5, vx: (Math.random() - .5) * 2, trail: 0 });
  }, delay || 0);
}
function explode(p, col) {
  const r = Math.random();
  burst(p, { n: Math.round(140 * FX), color: col, speed: 7 + Math.random() * 3, life: 2.2, size: 0.95 * (LOW ? 1.25 : 1), gravity: 2.4, additive: true });
  if (r < 0.35) burst(p, { n: Math.round(80 * FX), color: pickC(), speed: 4, life: 1.8, size: 0.75, gravity: 2, additive: true });       // 두 겹
  else if (r < 0.7) burst(p, { n: Math.round(72 * FX), color: pickC(), speed: 9, life: 1.6, size: 0.85, gravity: 0.6, additive: true, ring: true });   // 고리
  setTimeout(() => { for (let k = 0; k < (LOW ? 2 : 5); k++) burst(p.clone().add(new THREE.Vector3((Math.random() - .5) * 8, (Math.random() - .5) * 5, (Math.random() - .5) * 8)), { n: 12, color: 0xfff6d8, speed: 2.6, life: 0.45, size: 0.32, gravity: 1, additive: true }); }, 750);   // 탁탁 잔불
}
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i], h = r.head.position;
    h.y += r.vy * dt; h.x += r.vx * dt; r.vy = Math.max(5, r.vy - 7 * dt); r.trail += dt;
    if (r.trail > (LOW ? 0.09 : 0.045)) { r.trail = 0; burst(h.clone(), { n: 3, color: 0xffcf7a, speed: 0.5, life: 0.5, size: 0.3, gravity: 0.5, additive: true }); }
    if (h.y >= r.apex) { explode(h.clone(), r.col); scene.remove(r.head); r.head.material.dispose(); rockets.splice(i, 1); }
  }
}
let confetti = null;
function startConfetti() {
  const n = LOW ? 200 : 480, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n), col = new THREE.Color();
  const data = [];
  for (let i = 0; i < n; i++) { data.push({ p: new THREE.Vector3(-26 + Math.random() * 52, TOP + 4 + Math.random() * 26, -32 + Math.random() * 50), v: 1.6 + Math.random() * 1.8, sp: 2 + Math.random() * 4, ph: Math.random() * 6 }); im.setColorAt(i, col.setHex(CELEB[i % CELEB.length])); }
  scene.add(im); confetti = { im, data, o: new THREE.Object3D(), age: 0 };
}
function updateConfetti(dt, now) {
  if (!confetti) return; const { im, data, o } = confetti; confetti.age += dt;
  data.forEach((d, i) => {
    if (d.p.y > 0.05) { d.p.y -= d.v * dt; d.p.x += Math.sin(now * 1.3 + d.ph) * 0.8 * dt; d.p.z += Math.cos(now * 1.1 + d.ph) * 0.5 * dt; }
    else if (confetti.age < 30) d.p.y = TOP + 6 + Math.random() * 16;   // 30초 동안은 계속 내리고, 그 뒤엔 바닥에 쌓인 채 둔다
    o.position.copy(d.p); o.rotation.set(now * d.sp + d.ph, now * d.sp * 0.7, d.ph); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
}
let camSwing = 0.1;
// instant = 이어 그리기: 섬광·서서히 어두워짐 없이 바로 밤 장면 + 카드 + 폭죽
function complete(instant) {
  state.done = true; placed = ALL_STEPS; hud();
  if (instant) $('skyDusk').style.transition = 'none';
  document.body.classList.add('dusk');
  if (!instant) $('flash').classList.add('go');
  const toNight = k => {
    hemi.intensity = 0.85 - 0.5 * k; sun.intensity = 1 - 0.6 * k;
    sun.color.setRGB(1, 0.95 - 0.25 * k, 0.86 - 0.4 * k);
    scene.fog.color.setRGB(0.89 - 0.55 * k, 0.92 - 0.6 * k, 0.94 - 0.5 * k);
    ghostMat.opacity = 0.55 * (1 - k);
    blocks.forEach(b => b.userData.mats.forEach(m => { m.emissive.setRGB(k * b.userData.glow, k * b.userData.glow * 0.9, k * b.userData.glow * 0.7); }));
    markMats.forEach(m => m.emissive.setRGB(0.35 * k, 0.35 * k, 0.35 * k));
    glowMats.forEach(m => m.emissive.setRGB(0.8 * k, 0.72 * k, 0.55 * k));
    bgLit.forEach(([m, s]) => m.emissive.setRGB(s * k, s * k, s * k));
    bannerMat.emissive.setRGB(0.45 * k, 0.45 * k, 0.45 * k);
    lamps.forEach(l => { l.lm.emissive.setRGB(0.4 + 0.6 * k, 0.36 + 0.6 * k, 0.23 + 0.5 * k); l.beamMat.opacity = 0.16 * k; });
  };
  const camTo = k => { camH = 35 - 6 * ease.inOut(k); lookY = 4 + 3 * ease.inOut(k); };
  if (instant) { toNight(1); ghost.visible = false; camSwing = 0.32; camTo(1); fence.visible = false; }
  else {
    tween(1.6, k => { fence.position.y = -2.1 * ease.inOut(k); }, () => { fence.visible = false; });   // 공사 펜스: 땅속으로 내려가며 사라짐
    tween(6, k => { camSwing = 0.1 + 0.22 * ease.inOut(k); });   // 축하하는 동안 카메라가 조금 더 크게 돈다
    tween(4, toNight, () => { ghost.visible = false; });
    tween(5, camTo);
  }
  cheerAll(); setInterval(cheerAll, 6000);
  $('fCount').textContent = state.count;
  setTimeout(() => $('finale').classList.add('show'), instant ? 0 : 1200);
  // 폭죽: 첫 일제 발사(16발) → 쉬지 않고 이어 쏘기 → 20발마다 다시 일제 발사. 성능 낮춤 모드는 절반쯤
  if (!REDUCED) {
    const volley = Math.round(16 * FX), again = Math.round(10 * FX), gap = LOW ? 1.6 : 1;
    setTimeout(() => { for (let k = 0; k < volley; k++) launch(k * 110); startConfetti(); }, instant ? 0 : 900);
    let shot = 0; const keep = () => { launch(); if (++shot % 20 === 0) for (let k = 0; k < again; k++) launch(k * 90); setTimeout(keep, (300 + Math.random() * 450) * gap); };
    setTimeout(keep, instant ? 1500 : 3200);
  }
}

/* ===== 루프 ===== */
const clock = new THREE.Clock(); let t = 0, frameNo = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05); t += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.fn(k);
    if (k >= 1) { tweens.splice(i, 1); w.done && w.done(); }
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.age += dt; const pos = b.p.geometry.attributes.position;
    b.v.forEach((v, j) => { v.y -= b.gravity * dt; pos.setXYZ(j, pos.getX(j) + v.x * dt, Math.max(0, pos.getY(j) + v.y * dt), pos.getZ(j) + v.z * dt); });
    pos.needsUpdate = true; b.p.material.opacity = 1 - b.age / b.life;
    if (b.age >= b.life) { scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); bursts.splice(i, 1); }
  }
  updateWorkers(dt, t); updateCars(dt);
  deployed.forEach(d => d.ready && d.m.update(t, dt));
  crown.forEach(c => { if (c.visible && c.userData.flags) c.userData.flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2 + i) * 0.25; }); });
  cranes.forEach((c, n) => { if (!c.ready) return; if (!c.carried && !state.mayor) c.jib.rotation.y += Math.sin(t * 0.3 + n) * 0.0006; updateCable(c); });
  updateHeli(dt, t); updateRockets(dt); updateConfetti(dt, t);
  if (state.done) lamps.forEach((l, i) => { l.head.rotation.set(l.base.x + Math.sin(t * 0.9 + i) * 0.25, l.base.y + Math.sin(t * 0.6 + i * 1.7) * 0.7, l.base.z); });   // 탐조등이 하늘을 휘젓는다
  const az = (REDUCED ? CAM_AZ : CAM_AZ + Math.sin(t * 0.05) * camSwing);   // 남남동쪽: 중앙광장(봉화산로 쪽 면)이 정면, 잔디광장은 오른쪽
  camera.position.set(Math.sin(az) * camR, camH, TARGET_Z + Math.cos(az) * camR);
  camera.lookAt(0, lookY, TARGET_Z);
  if (rendererBg) {
    if ((frameNo++ & 1) === 0) { camera.layers.set(BG); rendererBg.render(scene, camera); }   // 먼 배경은 두 프레임에 한 번
    camera.layers.set(0);
  } else { camera.layers.set(0); camera.layers.enable(BG); }   // 성능 낮춤: 먼 배경도 본 화면에 한 번에(흐림 없음)
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
for (let i = 0; i < 3; i++) { makeWorker(false); workers[i].position.copy(randPoint()); }
hud(); loop();
return { arrive, mayorArrive, restore, state, ROLE_LABEL, lowQuality: LOW };
}
window.Site3D = { start };
})();
