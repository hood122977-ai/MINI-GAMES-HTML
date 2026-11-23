import { MAP, isLand, REGIONS, regionById, createPoints } from './geography.js';
export { MAP, isLand };
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const DEFINITIONS = Object.freeze({
  hq: { name: '사령부', tag: 'COMMAND CENTER', hp: 2800, r: 47, building: true, vision: 310 },
  mine: {
    name: '생산 기지',
    tag: 'REFINERY',
    hp: 650,
    r: 30,
    building: true,
    g: 100,
    w: 70,
    icon: '◈',
    desc: '초당 금 +8 · 합금 +5',
    vision: 180,
  },
  barracks: {
    name: '군사 기지',
    tag: 'BARRACKS',
    hp: 1000,
    r: 36,
    building: true,
    g: 160,
    w: 120,
    icon: '⚑',
    desc: '보병 · 사수 · 공성차 훈련',
    vision: 220,
  },
  wall: {
    name: '방벽',
    tag: 'BARRIER',
    hp: 1100,
    r: 19,
    building: true,
    g: 8,
    w: 18,
    icon: '▥',
    desc: '아군 유닛 320 이내 · 드래그 연속 설치',
    vision: 0,
  },
  tower: {
    name: '방어 포탑',
    tag: 'SENTRY',
    hp: 800,
    r: 26,
    building: true,
    g: 120,
    w: 90,
    icon: '⌖',
    desc: '사거리 230 · 자동 방어',
    range: 230,
    dmg: 28,
    cooldown: 1,
    vision: 180,
  },
  outpost: {
    name: '전초 기지',
    tag: 'OUTPOST',
    hp: 600,
    r: 24,
    building: true,
    g: 120,
    w: 100,
    icon: '⚐',
    desc: '영토 확장 · 전진 건설',
    vision: 300,
  },
  sword: {
    name: '돌격 보병',
    tag: 'VANGUARD',
    hp: 180,
    r: 12,
    g: 45,
    w: 0,
    icon: '⚔',
    desc: '빠른 기동 · 근접 전투',
    speed: 83,
    range: 30,
    dmg: 24,
    cooldown: 0.8,
    time: 4,
  },
  bow: {
    name: '지원 사수',
    tag: 'RANGER',
    hp: 105,
    r: 11,
    g: 65,
    w: 20,
    icon: '⌁',
    desc: '사거리 175 · 원거리 지원',
    speed: 73,
    range: 175,
    dmg: 15,
    cooldown: 1,
    time: 5,
  },
  ram: {
    name: '공성차',
    tag: 'BREAKER',
    hp: 500,
    r: 20,
    g: 150,
    w: 80,
    icon: '▣',
    desc: '중장갑 · 건물 피해 4배',
    speed: 48,
    range: 145,
    dmg: 24,
    cooldown: 1.8,
    time: 9,
  },
});
/** Observer: systems publish facts without knowing the HUD or renderer. */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }
  emit(type, payload) {
    this.listeners.get(type)?.forEach((fn) => fn(payload));
  }
}
/** Factory: game definitions are the only source of entity statistics. */
export class EntityFactory {
  constructor(definitions = DEFINITIONS) {
    this.definitions = definitions;
    this.nextId = 1;
  }
  create(type, x, y, team = 0) {
    const d = this.definitions[type];
    if (!d) throw Error('Unknown entity type');
    return {
      id: this.nextId++,
      type,
      x,
      y,
      team,
      hp: d.hp,
      maxhp: d.hp,
      r: d.r,
      queue: [],
      progress: 0,
      cd: 0,
      path: [],
      target: null,
      goal: null,
      stance: 'guard',
      angle: 0,
      repath: 0,
    };
  }
}
export class World {
  constructor(factory, bus) {
    this.factory = factory;
    this.bus = bus;
    this.reset();
  }
  reset(regionId = this.regionId || 'west') {
    this.regionId = regionId;
    const region = regionById(regionId);
    this.base = { ...region.base };
    this.enemyBase = regionId === 'central' ? { x: 7950, y: 7230 } : { x: 7740, y: 3120 };
    this.factory.nextId = 1;
    this.gold = region.gold;
    this.wood = region.wood;
    this.time = 0;
    this.wave = 0;
    this.nextWave = 140;
    this.ended = false;
    this.winner = null;
    this.entities = [];
    this.squads = {};
    this.revision = (this.revision || 0) + 1;
    this.points = createPoints();
    const b = this.base,
      e = this.enemyBase;
    for (const [t, dx, dy] of [
      ['hq', 0, 0],
      ['mine', -120, 130],
      ['barracks', 140, 100],
      ['tower', 100, -130],
    ])
      this.add(t, b.x + dx, b.y + dy, 0);
    for (const [t, dx, dy] of [
      ['hq', 0, 0],
      ['barracks', 140, 100],
      ['tower', -140, 130],
      ['tower', 140, -130],
    ])
      this.add(t, e.x + dx, e.y + dy, 1);
    for (let i = 0; i < 5; i++) this.add('wall', e.x - 240, e.y - 100 + i * 40, 1);
    for (let i = 0; i < 5; i++) this.add('sword', b.x + 100 + i * 30, b.y + 230);
    for (let i = 0; i < (regionId === 'east' ? 5 : 3); i++)
      this.add('bow', b.x + 100 + i * 30, b.y + 280);
    if (regionId === 'central') this.add('ram', b.x + 20, b.y + 230);
    for (let i = 0; i < 5; i++) this.add('sword', e.x - 130 + i * 30, e.y + 230, 1);
    this.bus.emit('reset');
  }
  add(type, x, y, team = 0) {
    const e = this.factory.create(type, x, y, team);
    this.entities.push(e);
    this.revision++;
    return e;
  }
  get(id) {
    return this.entities.find((e) => e.id === id && e.hp > 0);
  }
  units(team) {
    return this.entities.filter(
      (e) => !DEFINITIONS[e.type].building && e.hp > 0 && (team === undefined || e.team === team),
    );
  }
  buildings(team) {
    return this.entities.filter(
      (e) => DEFINITIONS[e.type].building && e.hp > 0 && (team === undefined || e.team === team),
    );
  }
  canAfford(d) {
    return this.gold >= d.g && this.wood >= d.w;
  }
  pay(d) {
    this.gold -= d.g;
    this.wood -= d.w;
  }
  finish(winner) {
    if (this.ended) return;
    this.ended = true;
    this.winner = winner;
    this.bus.emit('end', { winner, time: this.time, wave: this.wave });
  }
  snapshot() {
    return {
      version: 3,
      mapScale: 3,
      squads: this.squads,
      regionId: this.regionId,
      base: this.base,
      enemyBase: this.enemyBase,
      gold: this.gold,
      wood: this.wood,
      time: this.time,
      wave: this.wave,
      nextWave: this.nextWave,
      ended: this.ended,
      entities: this.entities,
      points: this.points,
    };
  }
  restore(s) {
    if (s?.version !== 3 || s.ended || !Array.isArray(s.entities) || !s.entities.length)
      return false;
    for (const e of s.entities)
      if (!DEFINITIONS[e.type] || !Number.isFinite(e.x) || !Number.isFinite(e.hp)) return false;
    s = structuredClone(s);
    if (s.mapScale !== 3) {
      const factor=3/(s.mapScale||1);
      for (const p of [...s.entities, ...s.points, s.base, s.enemyBase]) {
        p.x *= factor;
        p.y *= factor;
      }
      for (const e of s.entities)
        if (e.rally) {
          e.rally.x *= factor;
          e.rally.y *= factor;
        }
    }
    Object.assign(this, {
      squads: s.squads || {},
      regionId: s.regionId,
      base: s.base,
      enemyBase: s.enemyBase,
      gold: s.gold,
      wood: s.wood,
      time: s.time,
      wave: s.wave,
      nextWave: s.nextWave,
      entities: s.entities,
      points: s.points,
    });
    this.factory.nextId = Math.max(...s.entities.map((e) => e.id)) + 1;
    this.entities.forEach((e) => {
      e.path = [];
      e.goal = null;
      e.stance = 'guard';
      e.target = null;
    });
    this.revision++;
    return true;
  }
}
/** Storage port: callers can supply memory storage in tests. */
export class SaveRepository {
  constructor(storage, key = 'ironmarch-world-v3') {
    this.storage = storage;
    this.key = key;
  }
  load() {
    try {
      return JSON.parse(this.storage.getItem(this.key));
    } catch {
      return null;
    }
  }
  save(world) {
    try {
      this.storage.setItem(this.key, JSON.stringify(world.snapshot()));
    } catch {}
  }
  clear() {
    try {
      this.storage.removeItem(this.key);
    } catch {}
  }
}
