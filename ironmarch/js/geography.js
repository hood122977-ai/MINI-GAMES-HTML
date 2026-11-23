/** Shared geography: atlas, navigation, 3D terrain and minimap use the same source. */
export const MAP = Object.freeze({ w: 14400, h: 9600, cell: 40, cols: 360, rows: 240 });
export const CONTINENTS = [
  [
    [300, 940],
    [420, 730],
    [620, 700],
    [620, 500],
    [810, 420],
    [920, 250],
    [1140, 310],
    [1290, 200],
    [1480, 380],
    [1680, 420],
    [1800, 600],
    [2100, 520],
    [2290, 620],
    [2500, 500],
    [2650, 720],
    [2910, 790],
    [3050, 1040],
    [3240, 1190],
    [3200, 1390],
    [3000, 1510],
    [2800, 1450],
    [2680, 1660],
    [2480, 1710],
    [2290, 1550],
    [2050, 1580],
    [1830, 1460],
    [1620, 1540],
    [1460, 1390],
    [1190, 1470],
    [990, 1340],
    [740, 1390],
    [560, 1220],
    [350, 1220],
  ],
  [
    [1600, 2060],
    [1810, 1900],
    [2070, 1950],
    [2220, 1800],
    [2470, 1870],
    [2630, 1780],
    [2810, 1910],
    [3000, 1890],
    [3220, 2070],
    [3310, 2360],
    [3150, 2550],
    [3000, 2740],
    [2710, 2800],
    [2520, 2990],
    [2290, 2890],
    [2110, 2940],
    [1940, 2750],
    [1710, 2670],
    [1600, 2420],
    [1450, 2300],
  ],
  [
    [3700, 650],
    [3880, 530],
    [4110, 600],
    [4170, 780],
    [4380, 880],
    [4330, 1090],
    [4450, 1240],
    [4250, 1350],
    [4190, 1560],
    [3970, 1640],
    [3810, 1470],
    [3630, 1370],
    [3700, 1160],
    [3580, 980],
  ],
  [
    [3890, 2250],
    [4050, 2150],
    [4270, 2250],
    [4380, 2440],
    [4260, 2670],
    [4060, 2790],
    [3850, 2670],
    [3780, 2460],
  ],
];
export const BRIDGES = [
  { name: '쌍둥이 관문', x: 2570, y: 1760, w: 160, h: 420 },
  { name: '동해 대교', x: 3460, y: 1370, w: 760, h: 120 },
  { name: '그림자 연결로', x: 4050, y: 1920, w: 120, h: 760 },
];
export const REGIONS = [
  {
    id: 'west',
    name: '아르덴 왕국',
    en: 'ARDEN HIGHLANDS',
    tag: '서부 초원',
    icon: '♜',
    x: 960,
    y: 1110,
    color: '#9cba7a',
    description:
      '비옥한 초원과 완만한 구릉. 서쪽에서 생산 기반을 다지고 중앙 요새를 향해 진격하세요.',
    base: { x: 800, y: 1050 },
    difficulty: '입문',
    bonus: '시작 금 +150',
    gold: 800,
    wood: 420,
  },
  {
    id: 'north',
    name: '서리봉 변경',
    en: 'FROSTVEIL REACH',
    tag: '북부 설산',
    icon: '❄',
    x: 1320,
    y: 630,
    color: '#b9d2df',
    description:
      '눈 덮인 산맥 아래 펼쳐진 북부 전선. 방벽과 포탑으로 진입로를 지키며 병력을 모으세요.',
    base: { x: 1120, y: 650 },
    difficulty: '보통',
    bonus: '시작 합금 +180',
    gold: 650,
    wood: 600,
  },
  {
    id: 'central',
    name: '철혈 요새',
    en: 'IRON CROWN',
    tag: '중앙 고원',
    icon: '♛',
    x: 2520,
    y: 1090,
    color: '#bc9271',
    description:
      '대륙의 길목을 차지한 거대한 고원. 남부의 적 사령부를 향해 쌍둥이 관문을 돌파하세요.',
    base: { x: 2380, y: 1000 },
    difficulty: '보통',
    bonus: '시작 공성차 1기',
    gold: 650,
    wood: 420,
  },
  {
    id: 'south',
    name: '태양의 사막',
    en: 'SOLARIS EXPANSE',
    tag: '남부 사막',
    icon: '☀',
    x: 2410,
    y: 2400,
    color: '#d5b675',
    description:
      '황금빛 모래와 오래된 유적의 땅. 넓은 남부 대륙에서 거점을 확보하고 북쪽 관문으로 진군하세요.',
    base: { x: 2130, y: 2370 },
    difficulty: '보통',
    bonus: '시작 금 +250',
    gold: 900,
    wood: 420,
  },
  {
    id: 'east',
    name: '비취 군도',
    en: 'JADE ARCHIPELAGO',
    tag: '동부 숲',
    icon: '❖',
    x: 4000,
    y: 1090,
    color: '#6da88b',
    description:
      '안개와 짙은 숲에 둘러싸인 동쪽 군도. 대교를 통과하는 좁은 길에서 종대와 원거리 부대를 활용하세요.',
    base: { x: 3900, y: 1000 },
    difficulty: '도전',
    bonus: '시작 사수 +2기',
    gold: 650,
    wood: 420,
  },
  {
    id: 'shadow',
    name: '황혼의 해안',
    en: 'DUSKFALL COAST',
    tag: '남동부 해안',
    icon: '☽',
    x: 4090,
    y: 2490,
    color: '#9a94b0',
    description:
      '대륙에서 가장 먼 고립된 해안. 두 개의 다리를 건너 원정군을 이끌고 중앙의 적 요새를 함락하세요.',
    base: { x: 3950, y: 2370 },
    difficulty: '도전',
    bonus: '시작 금 +100 · 합금 +100',
    gold: 750,
    wood: 520,
  },
];
// Original western crescent: a broad overland route between north and south.
CONTINENTS.push([[450,1120],[940,1250],[1220,1640],[1660,1820],[1980,2040],[1960,2550],[1550,2770],[1100,2610],[930,2230],[620,2060],[380,1690]]);
// Long eastern ridge joins the archipelago and creates a second invasion route.
CONTINENTS.push([[4000,1400],[4280,1510],[4510,1860],[4490,2210],[4250,2460],[3970,2320],[4160,1970],[3860,1690]]);
// Expand traversable land, not just the ocean or camera bounds.
for (const polygon of CONTINENTS)
  for (const p of polygon) {
    p[0] *= 3;
    p[1] *= 3;
  }
for (const b of BRIDGES) for (const k of ['x', 'y', 'w', 'h']) b[k] *= 3;
for (const r of REGIONS) {
  r.x *= 3;
  r.y *= 3;
  r.base.x *= 3;
  r.base.y *= 3;
}
export const regionById = (id) => REGIONS.find((r) => r.id === id) || REGIONS[0];
function inside(x, y, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let a = poly[i],
      b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}
export const bridgeAt = (x, y) =>
  BRIDGES.find((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2);
function rawLand(x, y) {
  return !!bridgeAt(x, y) || CONTINENTS.some((p) => inside(x, y, p));
}
export function isLand(x, y, margin = 0) {
  if (x < 0 || y < 0 || x > MAP.w || y > MAP.h || !rawLand(x, y)) return false;
  if (!margin) return true;
  return [
    [margin, 0],
    [-margin, 0],
    [0, margin],
    [0, -margin],
  ].every(([dx, dy]) => rawLand(x + dx, y + dy));
}
export function biomeAt(x, y) {
  if (bridgeAt(x, y)) return 'bridge';
  x /= 3;
  y /= 3;
  if (x > 3600 && y > 2100) return 'shadow';
  if (x > 3500) return 'forest';
  if (y > 1780) return 'desert';
  if (y < 790 && x < 1900) return 'snow';
  if (x > 2100) return 'highland';
  return 'grass';
}
export const BIOMES = {
  grass: { color: 0x7a925c, css: '#839968' },
  snow: { color: 0xb4c7c9, css: '#aebfc3' },
  desert: { color: 0xc4a66c, css: '#ba9a62' },
  forest: { color: 0x4e8267, css: '#577d62' },
  shadow: { color: 0x68747a, css: '#667176' },
  highland: { color: 0x8a8b65, css: '#96936c' },
  bridge: { color: 0x7f898a, css: '#8d9290' },
};
export const nearestRegion = (x, y) =>
  REGIONS.reduce((a, b) => (Math.hypot(x - a.x, y - a.y) < Math.hypot(x - b.x, y - b.y) ? a : b));
export function createPoints() {
  return REGIONS.map((r) => ({
    id: r.id,
    name: r.name,
    x: r.x + 150,
    y: r.y + 120,
    owner: -1,
    progress: 0,
    capturing: -1,
  })).concat([
    { id: 'gate', name: '쌍둥이 관문', x: 7710, y: 5220, owner: -1, progress: 0, capturing: -1 },
    { id: 'bridge', name: '동해 대교', x: 10350, y: 4110, owner: -1, progress: 0, capturing: -1 },
  ]);
}
