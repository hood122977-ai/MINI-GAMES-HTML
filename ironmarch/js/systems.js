import { formationSlots } from './formations.js';
import { MAP, DEFINITIONS as D, distance, isLand } from './core.js';
export class Navigation {
  constructor(world) {
    this.world = world;
    this.cacheRevision = -1;
    this.cols = MAP.cols;
    this.rows = MAP.rows;
  }
  blocked(x, y, r = 10) {
    return (
      !isLand(x, y, r) ||
      this.world
        .buildings()
        .some((e) => Math.abs(x - e.x) < e.r + r - 2 && Math.abs(y - e.y) < e.r + r - 2)
    );
  }
  grid(r) {
    if (this.cacheRevision !== this.world.revision) {
      this.cacheRevision = this.world.revision;
      this.grids = new Map();
    }
    const key = r > 15 ? 20 : 12;
    if (this.grids.has(key)) return this.grids.get(key);
    const g = new Uint8Array(MAP.cols * MAP.rows);
    for (let y = 0; y < MAP.rows; y++)
      for (let x = 0; x < MAP.cols; x++)
        g[y * MAP.cols + x] = this.blocked(x * 40 + 20, y * 40 + 20, key) ? 1 : 0;
    this.grids.set(key, g);
    return g;
  }
  path(e, p) {
    const C = MAP.cols,
      R = MAP.rows,
      sx = Math.max(0, Math.min(C - 1, Math.floor(e.x / 40))),
      sy = Math.max(0, Math.min(R - 1, Math.floor(e.y / 40))),
      tx = Math.max(0, Math.min(C - 1, Math.floor(p.x / 40))),
      ty = Math.max(0, Math.min(R - 1, Math.floor(p.y / 40)));
    const start = sy * C + sx,
      dest = ty * C + tx,
      g = this.grid(e.r),
      prev = new Int32Array(C * R).fill(-1),
      q = [start];
    prev[start] = start;
    let best = start,
      bd = Infinity;
    for (let i = 0; i < q.length; i++) {
      let n = q[i],
        x = n % C,
        y = Math.floor(n / C),
        dd = (x - tx) ** 2 + (y - ty) ** 2;
      if (dd < bd) {
        bd = dd;
        best = n;
      }
      if (n === dest) break;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let xx = x + dx,
          yy = y + dy,
          k = yy * C + xx;
        if (xx < 0 || yy < 0 || xx >= C || yy >= R || prev[k] !== -1 || g[k]) continue;
        prev[k] = n;
        q.push(k);
      }
    }
    let path = [];
    for (let n = best; n !== start && prev[n] >= 0; n = prev[n])
      path.push({ x: (n % C) * 40 + 20, y: Math.floor(n / C) * 40 + 20 });
    path.reverse();
    if (best === dest && !this.blocked(p.x, p.y, e.r)) path.push({ ...p });
    return path;
  }
}
/** Strategy: attack damage policies can change without altering CombatSystem. */
export class StandardDamage {
  calculate(a, b) {
    return D[a.type].dmg || 0;
  }
}
export class SiegeDamage {
  calculate(a, b) {
    return D[a.type].dmg * (D[b.type].building ? 4 : 1);
  }
}
export class EconomySystem {
  update(w, dt) {
    const mines = w.buildings(0).filter((e) => e.type === 'mine').length,
      points = w.points.filter((p) => p.owner === 0).length;
    w.gold += dt * (2 + 8 * mines + points * 5);
    w.wood += dt * (1 + 5 * mines + points * 3);
  }
}
export class TrainingSystem {
  constructor(nav) {
    this.nav = nav;
  }
  update(w, dt) {
    for (const b of w.buildings()) {
      if (!b.queue.length) continue;
      b.progress += dt;
      let t = b.queue[0];
      if (b.progress < D[t].time) continue;
      let p = null;
      for (let rad = 85; rad < 210 && !p; rad += 25)
        for (let a = 0; a < Math.PI * 2; a += 0.35) {
          let v = { x: b.x + Math.cos(a) * rad, y: b.y + Math.sin(a) * rad };
          if (
            !this.nav.blocked(v.x, v.y, D[t].r) &&
            !w.units().some((u) => distance(u, v) < u.r + D[t].r + 4)
          ) {
            p = v;
            break;
          }
        }
      if (p) {
        const u = w.add(t, p.x, p.y, b.team);
        b.queue.shift();
        b.progress = 0;
        if (b.rally) {
          u.goal = { ...b.rally };
          u.path = this.nav.path(u, u.goal);
          u.stance = 'attack';
        }
        w.bus.emit('trained', u);
      }
    }
  }
}
export class CombatSystem {
  constructor(nav, damageStrategies = { default: new StandardDamage(), ram: new SiegeDamage() }) {
    this.nav = nav;
    this.damage = damageStrategies;
  }
  update(w, dt) {
    for (const e of w.entities) {
      if (e.hp <= 0) continue;
      const d = D[e.type];
      if (d.building && e.type !== 'tower') continue;
      e.cd = Math.max(0, e.cd - dt);
      e.repath -= dt;
      let target = w.get(e.target);
      if (target?.team === e.team) target = null;
      const allowAuto = e.stance !== 'move' || !e.path.length || d.building;
      if (!target && allowAuto) {
        const range = (d.range || 0) + 100;
        target = w.entities
          .filter((n) => n.hp > 0 && n.team !== e.team && distance(e, n) < range + n.r)
          .sort((a, b) => distance(e, a) - distance(e, b))[0];
      }
      e.firing = false;
      if (target) {
        let len = distance(e, target);
        e.angle = Math.atan2(target.x - e.x, target.y - e.y);
        if (len <= (d.range || 0) + target.r) {
          e.firing = true;
          if (e.cd <= 0) {
            const damage = (this.damage[e.type] || this.damage.default).calculate(e, target);
            target.hp -= damage;
            e.cd = d.cooldown || 1;
            w.bus.emit('shot', {
              from: { x: e.x, y: e.y },
              to: { x: target.x, y: target.y },
              team: e.team,
              heavy: e.type === 'ram',
            });
          }
          continue;
        }
        if (!d.building && e.stance !== 'hold' && e.repath <= 0) {
          e.path = this.nav.path(e, target);
          e.repath = 1;
        }
      } else if (e.target) {
        e.target = null;
        e.path = [];
        e.goal = null;
      }
      e.activeTarget = target?.id || null;
    }
    for (const e of w.entities.filter((e) => e.hp <= 0)) {
      w.bus.emit('destroyed', e);
      w.revision++;
      if (e.type === 'hq') w.finish(e.team === 1 ? 0 : 1);
    }
    w.entities = w.entities.filter((e) => e.hp > 0);
  }
}
export class MovementSystem {
  constructor(nav) {
    this.nav = nav;
  }
  update(w, dt) {
    for (const e of w.units()) {
      if (e.firing) continue;
      let p = e.path[0];
      if (!p) {
        if (!e.activeTarget) {
          if (e.stance !== 'hold') e.stance = 'guard';
          e.goal = null;
        }
        e.moving = false;
        continue;
      }
      let dx = p.x - e.x,
        dy = p.y - e.y,
        l = Math.hypot(dx, dy),
        step = (e.activeTarget ? D[e.type].speed : e.moveSpeed || D[e.type].speed) * dt;
      e.moving = true;
      e.angle = Math.atan2(dx, dy);
      if (l < step + 1) {
        e.path.shift();
        continue;
      }
      let nx = e.x + (dx / l) * step,
        ny = e.y + (dy / l) * step;
      if (!this.nav.blocked(nx, ny, e.r)) {
        e.x = nx;
        e.y = ny;
      } else if (e.repath <= 0) {
        const t = w.get(e.activeTarget) || e.goal;
        if (t) e.path = this.nav.path(e, t);
        e.repath = 0.8;
      }
    }
    const us = w.units();
    for (let i = 0; i < us.length; i++)
      for (let j = i + 1; j < us.length; j++) {
        let a = us[i],
          b = us[j],
          l = distance(a, b),
          r = (a.r + b.r) * 0.9;
        if (l > 0 && l < r) {
          let k = ((r - l) * 0.22) / l,
            dx = (a.x - b.x) * k,
            dy = (a.y - b.y) * k;
          if (!this.nav.blocked(a.x + dx, a.y + dy, a.r)) {
            a.x += dx;
            a.y += dy;
          }
          if (!this.nav.blocked(b.x - dx, b.y - dy, b.r)) {
            b.x -= dx;
            b.y -= dy;
          }
        }
      }
  }
}
export class TerritorySystem {
  constructor() {
    this.elapsed = 0;
    this.cells = [];
    this.revision = -1;
    this.shares = [0, 0];
    for (let y = 40; y < MAP.h; y += 80)
      for (let x = 40; x < MAP.w; x += 80)
        if (isLand(x, y, 25)) this.cells.push({ x, y, owner: -1 });
  }
  ownerAt(w, p) {
    let owner = -1,
      score = 0;
    for (const e of w.buildings()) {
      let v = D[e.type].vision - distance(p, e);
      if (v > score) {
        score = v;
        owner = e.team;
      }
    }
    for (const e of w.points) {
      let v = 240 - distance(p, e);
      if (e.owner >= 0 && v > score) {
        score = v;
        owner = e.owner;
      }
    }
    return owner;
  }
  update(w, dt) {
    for (const p of w.points) {
      let near = w.units().filter((e) => distance(e, p) < 100),
        a = near.some((e) => e.team === 0),
        b = near.some((e) => e.team === 1);
      if (a === b) continue;
      let team = a ? 0 : 1;
      if (p.owner === team) {
        p.progress = 0;
        continue;
      }
      if (p.capturing !== team) {
        p.progress = 0;
        p.capturing = team;
      }
      p.progress += dt;
      if (p.progress >= 7) {
        p.owner = team;
        p.progress = 0;
        w.revision++;
        w.bus.emit('capture', p);
      }
    }
    this.elapsed += dt;
    if (this.elapsed < 0.5 && this.revision === w.revision) return;
    this.elapsed = 0;
    this.revision = w.revision;
    let count = [0, 0];
    for (const c of this.cells) {
      c.owner = this.ownerAt(w, c);
      if (c.owner >= 0) count[c.owner]++;
    }
    this.shares = count.map((n) => Math.round((n / this.cells.length) * 100));
  }
}
export class EnemyDirector {
  constructor(nav) {
    this.nav = nav;
  }
  update(w) {
    if (w.time < w.nextWave) return;
    w.wave++;
    w.nextWave = w.time + 100;
    const count = Math.min(4 + w.wave, 15),
      room = 65 - w.units(1).length;
    for (let i = 0; i < Math.min(room, count); i++) {
      let t = w.wave > 2 && i === 0 ? 'ram' : i % 4 === 0 ? 'bow' : 'sword',
        u = w.add(
          t,
          w.enemyBase.x - 100 + (i % 5) * 30,
          w.enemyBase.y + 280 + Math.floor(i / 5) * 30,
          1,
        );
      u.goal = { ...w.base };
      u.stance = 'attack';
      u.path = this.nav.path(u, u.goal);
    }
    w.bus.emit('wave', w.wave);
  }
}
/** Command: input expresses intent; only commands validate and mutate state. */
export class BuildCommand {
  constructor(type, point, builders = []) {
    this.type = type;
    this.point = point;
    this.builders = builders;
  }
  static preview(w, type, p, builders = []) {
    const d = D[type],
      x = Math.round((p.x - 20) / 40) * 40 + 20,
      y = Math.round((p.y - 20) / 40) * 40 + 20;
    let reason = '';
    if (!isLand(x, y, d.r + 12)) reason = '육지 안쪽에 건설하세요.';
    else if (w.entities.some((e) => distance({ x, y }, e) < d.r + e.r + 1))
      reason = '다른 건물이나 유닛과 겹칩니다.';
    else if(type==='wall' && !w.units(0).some(e=>e.hp>0&&distance({x,y},e)<=320))
      reason='방벽 설치 지점에서 320 이내에 아군 유닛이 필요합니다.';
    else if (
      type!=='wall' && !(
        builders.length
          ? builders.map((id) => w.get(id)).filter((e) => e && e.team === 0)
          : w.buildings(0).filter((e) => e.type === 'hq')
      ).some((e) => distance({ x, y }, e) < 320)
    )
      reason = '선택한 아군이나 사령부에서 320 이내에 건설하세요.';
    else if (!w.canAfford(d)) reason = '자원이 부족합니다.';
    return { x, y, ok: !reason, reason };
  }
  execute(w) {
    let p = BuildCommand.preview(w, this.type, this.point, this.builders);
    if (!p.ok) return p.reason;
    w.pay(D[this.type]);
    w.add(this.type, p.x, p.y);
    w.bus.emit('built', { type: this.type, ...p });
    return null;
  }
}
export class TrainCommand {
  constructor(id, type) {
    this.id = id;
    this.type = type;
  }
  execute(w) {
    const b = w.get(this.id),
      d = D[this.type];
    if (!b || b.team !== 0 || b.type !== 'barracks') return '아군 군사 기지를 먼저 선택하세요.';
    if (b.queue.length >= 8) return '훈련 대기열이 가득 찼습니다.';
    if (w.units(0).length + w.buildings(0).reduce((s, b) => s + b.queue.length, 0) >= 80)
      return '병력 한도 80명에 도달했습니다.';
    if (!w.canAfford(d)) return '자원이 부족합니다.';
    w.pay(d);
    b.queue.push(this.type);
    w.bus.emit('notice', `${d.name} 훈련 대기열에 추가`);
    return null;
  }
}
export class MoveCommand {
  constructor(ids, point, target = null, assault = false, formation = 'box') {
    Object.assign(this, { ids, point, target, assault, formation });
  }
  execute(w, services) {
    const es = this.ids
      .map((id) => w.get(id))
      .filter((e) => e && e.team === 0 && !D[e.type].building)
      .sort(
        (a, b) => ['sword', 'bow', 'ram'].indexOf(a.type) - ['sword', 'bow', 'ram'].indexOf(b.type),
      );
    if (!es.length) return '아군 부대를 먼저 선택하세요.';
    if (!isLand(this.point.x, this.point.y)) return '육지나 다리에 이동 지점을 지정하세요.';
    const center = es.reduce((a, e) => ({ x: a.x + e.x / es.length, y: a.y + e.y / es.length }), {
        x: 0,
        y: 0,
      }),
      angle = Math.atan2(this.point.x - center.x, this.point.y - center.y),
      slots = formationSlots(es.length, this.formation),
      speed = Math.min(...es.map((e) => D[e.type].speed));
    es.forEach((e, i) => {
      const slot = slots[i];
      e.goal = {
        x: this.point.x + slot.x * Math.cos(angle) - slot.y * Math.sin(angle),
        y: this.point.y - slot.x * Math.sin(angle) - slot.y * Math.cos(angle),
      };
      if (!isLand(e.goal.x, e.goal.y, e.r)) e.goal = { ...this.point };
      e.target = this.target?.team === 1 ? this.target.id : null;
      e.stance = this.assault || e.target ? 'attack' : 'move';
      e.moveSpeed = speed;
      e.path = services.nav.path(e, e.goal);
      e.repath = 0;
    });
    w.bus.emit('order', { ...this.point, attack: this.assault || !!this.target });
    return null;
  }
}
export class HoldCommand {
  constructor(ids) {
    this.ids = ids;
  }
  execute(w) {
    for (const id of this.ids) {
      const e = w.get(id);
      if (!e || e.team !== 0 || D[e.type].building) continue;
      e.path = [];
      e.goal = null;
      e.target = null;
      e.activeTarget = null;
      e.stance = 'hold';
      e.moving = false;
    }
    w.bus.emit('notice', '위치 사수 · 이동하지 않고 사거리 안의 적만 공격합니다.');
    return null;
  }
}
export class CommandDispatcher {
  constructor(world, services) {
    this.world = world;
    this.services = services;
  }
  dispatch(command, silent = false) {
    if (this.world.ended) return false;
    const error = command.execute(this.world, this.services);
    if (error && !silent) this.world.bus.emit('notice', error);
    return !error;
  }
}

export class StopCommand {
  constructor(ids) {
    this.ids = ids;
  }
  execute(world) {
    for (const id of this.ids) {
      const unit = world.get(id);
      if (!unit || unit.team !== 0 || D[unit.type].building) continue;
      unit.path = [];
      unit.goal = null;
      unit.target = null;
      unit.stance = 'guard';
      unit.activeTarget = null;
    }
    world.bus.emit('notice', '선택 부대 정지');
    return null;
  }
}
export class RallyCommand {
  constructor(id, point) {
    this.id = id;
    this.point = point;
  }
  execute(world) {
    const building = world.get(this.id);
    if (!building || building.team !== 0 || building.type !== 'barracks')
      return '아군 군사 기지를 선택하세요.';
    if (!isLand(this.point.x, this.point.y)) return '육지에 집결 지점을 지정하세요.';
    building.rally = { ...this.point };
    world.bus.emit('order', this.point);
    world.bus.emit('notice', '새 유닛 집결 지점 설정');
    return null;
  }
}
