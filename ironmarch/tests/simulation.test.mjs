import { wallStroke } from '../js/walls.js';
import { SelectionService } from '../js/selection.js';
import { REGIONS, isLand } from '../js/geography.js';
import { formationSlots, SquadService } from '../js/formations.js';
import { HoldCommand } from '../js/systems.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EventBus,
  EntityFactory,
  World,
  SaveRepository,
  DEFINITIONS as D,
} from '../js/core.js';
import {
  Navigation,
  EconomySystem,
  TrainingSystem,
  CombatSystem,
  MovementSystem,
  TerritorySystem,
  EnemyDirector,
  CommandDispatcher,
  BuildCommand,
  TrainCommand,
  MoveCommand,
} from '../js/systems.js';
function setup() {
  const bus = new EventBus(),
    w = new World(new EntityFactory(), bus),
    nav = new Navigation(w),
    commands = new CommandDispatcher(w, { nav });
  return { w, nav, commands, bus };
}
test('construction validates resources, placement and adjacent walls', () => {
  let { w, nav, commands } = setup();
  let g = w.gold;
  assert(commands.dispatch(new BuildCommand('wall', { x: 2380, y: 3260 })));
  assert.equal(w.gold, g - 8);
  assert(nav.blocked(2380, 3260));
  assert(commands.dispatch(new BuildCommand('wall', { x: 2420, y: 3260 })));
  let before = w.gold;
  assert(!commands.dispatch(new BuildCommand('wall', { x: 2380, y: 3260 })));
  assert.equal(w.gold, before);
  assert(!commands.dispatch(new BuildCommand('mine', { x: 50, y: 50 })));
});
test('training spends once and creates a unit outside blocked ground', () => {
  let { w, nav, commands } = setup(),
    b = w.buildings(0).find((e) => e.type === 'barracks'),
    g = w.gold;
  assert(commands.dispatch(new TrainCommand(b.id, 'ram')));
  assert.equal(w.gold, g - 150);
  const sys = new TrainingSystem(nav);
  for (let i = 0; i < 280; i++) sys.update(w, 1 / 30);
  assert.equal(w.units(0).length, 9);
  let u = w.units(0).at(-1);
  assert.equal(u.type, 'ram');
  assert(!nav.blocked(u.x, u.y, u.r));
  assert.equal(b.queue.length, 0);
});
test('movement routes around buildings and excludes enemy control', () => {
  let { w, nav, commands } = setup(),
    u = w.units(0)[0],
    enemy = w.units(1)[0];
  const old = { x: u.x, y: u.y };
  commands.dispatch(new MoveCommand([u.id, enemy.id], { x: 2650, y: 3100 }));
  assert(u.path.length);
  assert.equal(enemy.path.length, 0);
  const movement = new MovementSystem(nav);
  for (let i = 0; i < 200; i++) movement.update(w, 1 / 30);
  assert(Math.hypot(u.x - old.x, u.y - old.y) > 100);
  assert(!nav.blocked(u.x, u.y, u.r));
});
test('capture requires presence; contested point does not progress; income grows', () => {
  let { w } = setup(),
    p = w.points[0],
    t = new TerritorySystem();
  w.entities = w.entities.filter((e) => D[e.type].building);
  let u = w.add('sword', p.x, p.y);
  for (let i = 0; i < 100; i++) t.update(w, 0.1);
  assert.equal(p.owner, 0);
  const econ = new EconomySystem(),
    g = w.gold;
  econ.update(w, 1);
  assert.equal(w.gold - g, 15);
  w.add('sword', p.x, p.y, 1);
  p.owner = -1;
  p.progress = 0;
  t.update(w, 10);
  assert.equal(p.owner, -1);
});
test('damage strategies apply siege multiplier and emit victory once', () => {
  let { w, nav, bus } = setup();
  w.entities = [];
  let ram = w.add('ram', 1000, 800),
    wall = w.add('wall', 1100, 800, 1);
  let combat = new CombatSystem(nav);
  combat.update(w, 0.1);
  assert.equal(wall.hp, D.wall.hp - 96);
  w.entities = [ram];
  let hq = w.add('hq', 1100, 800, 1);
  hq.hp = 1;
  ram.cd = 0;
  let ends = 0;
  bus.on('end', () => ends++);
  combat.update(w, 0.1);
  combat.update(w, 0.1);
  assert(w.ended);
  assert.equal(w.winner, 0);
  assert.equal(ends, 1);
});
test('enemy wave and resource progression during simulation', () => {
  let { w, nav } = setup();
  w.time = w.nextWave;
  new EnemyDirector(nav).update(w, 1);
  assert.equal(w.wave, 1);
  assert.equal(w.units(1).length, 10);
  let econ = new EconomySystem();
  let gold = w.gold;
  econ.update(w, 2);
  assert.equal(w.gold, gold + 20);
});
test('save round trip preserves economy, ownership, queue, IDs', () => {
  let { w } = setup();
  let store = new Map(),
    repo = new SaveRepository({
      getItem: (k) => store.get(k),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    });
  w.gold = 777;
  w.points[0].owner = 0;
  w.buildings(0).find((e) => e.type === 'barracks').queue = ['bow'];
  repo.save(w);
  let restored = new World(new EntityFactory(), new EventBus());
  assert(restored.restore(repo.load()));
  assert.equal(restored.gold, 777);
  assert.equal(restored.points[0].owner, 0);
  assert(restored.factory.nextId > Math.max(...restored.entities.map((e) => e.id)));
  repo.clear();
  assert.equal(repo.load(), null);
});

test('six campaign starts are on land and can reach all eight capture points', () => {
  for (const region of REGIONS) {
    const { w, nav } = setup();
    w.reset(region.id);
    assert.equal(w.points.length, 8);
    for (const e of w.entities)
      assert(isLand(e.x, e.y, e.r), `${region.id}: ${e.type} spawned at sea`);
    for (const p of w.points) {
      const end = nav.path(w.units(0)[0], p).at(-1);
      assert(
        end && Math.hypot(end.x - p.x, end.y - p.y) < 80,
        `${region.id}: cannot reach ${p.name}`,
      );
    }
  }
});
test('formation strategies create distinct slots with line and column orientation', () => {
  for (const kind of ['box', 'line', 'column', 'wedge']) {
    const slots = formationSlots(12, kind);
    assert.equal(new Set(slots.map((p) => `${p.x},${p.y}`)).size, 12);
  }
  const span = (slots, key) =>
    Math.max(...slots.map((p) => p[key])) - Math.min(...slots.map((p) => p[key]));
  assert(span(formationSlots(8, 'line'), 'x') > span(formationSlots(8, 'line'), 'y'));
  assert(span(formationSlots(8, 'column'), 'y') > span(formationSlots(8, 'column'), 'x'));
});
test('squads reject enemy IDs, survive save, and filter destroyed members', () => {
  const { w, bus } = setup(),
    squads = new SquadService(w, bus),
    ids = w
      .units(0)
      .slice(0, 3)
      .map((e) => e.id);
  assert(squads.assign(1, [...ids, w.units(1)[0].id]));
  assert.deepEqual(squads.members(1), ids);
  const restored = new World(new EntityFactory(), new EventBus());
  restored.restore(w.snapshot());
  assert.deepEqual(new SquadService(restored, restored.bus).members(1), ids);
  w.entities = w.entities.filter((e) => e.id !== ids[0]);
  assert.deepEqual(squads.members(1), ids.slice(1));
});
test('hold position fires in range but never pursues nearby enemies', () => {
  const { w, nav, commands } = setup();
  w.entities = [];
  const u = w.add('sword', 1000, 1000),
    enemy = w.add('sword', 1100, 1000, 1);
  commands.dispatch(new HoldCommand([u.id]));
  new CombatSystem(nav).update(w, 0.1);
  new MovementSystem(nav).update(w, 0.1);
  assert.equal(u.x, 1000);
  assert.equal(u.path.length, 0);
  assert.equal(u.stance, 'hold');
  enemy.x = 1020;
  u.cd = 0;
  new CombatSystem(nav).update(w, 0.1);
  assert(enemy.hp < D.sword.hp);
});

test('type selection controls only requested friendly units; additive selection merges', () => {
  const { w } = setup(),
    service = new SelectionService(w);
  const bows = service.choose('bow');
  assert.equal(bows.size, 3);
  for (const id of bows) assert.equal(w.get(id).type, 'bow');
  const merged = service.choose('sword', bows, true);
  assert.equal(merged.size, 8);
  assert.equal(service.choose('ram').size, 0);
});
test('old world saves migrate positions and retain group IDs', () => {
  const { w } = setup();
  w.squads = { 1: [w.units(0)[0].id] };
  const s = structuredClone(w.snapshot());
  delete s.mapScale;
  for (const p of [...s.entities, ...s.points, s.base, s.enemyBase]) {
    p.x /= 3;
    p.y /= 3;
  }
  const restored = setup().w;
  assert(restored.restore(s));
  assert.deepEqual(restored.base, w.base);
  assert.deepEqual(restored.squads, w.squads);
  assert.equal(restored.units(0)[0].x, w.units(0)[0].x);
});


test('walls require a nearby living friendly unit regardless of selection', () => {
  const { w } = setup();
  const p = { x: 3540, y: 3140 };
  assert.equal(BuildCommand.preview(w, 'wall', p, []).ok, false);
  const unit = w.units(0)[0];
  unit.x = 3400; unit.y = 3140;
  assert.equal(BuildCommand.preview(w, 'wall', p, []).ok, true);
  assert.equal(BuildCommand.preview(w, 'wall', p, [w.units(1)[0].id]).ok, true);
  unit.hp = 0;
  assert.equal(BuildCommand.preview(w, 'wall', p, [unit.id]).ok, false);
  unit.hp = 100; unit.team = 1;
  assert.equal(BuildCommand.preview(w, 'wall', p, []).ok, false);
  w.add('hq', 3400, 3140, 0);
  assert.equal(BuildCommand.preview(w, 'wall', p, []).ok, false);
});
test('wall strokes stay connected without duplicate cells in every direction', () => {
  for(const end of [{x:420,y:20},{x:420,y:420},{x:-420,y:180},{x:20,y:20}]){
    const cells=wallStroke({x:20,y:20},end);
    assert.equal(new Set(cells.map(p=>p.x+','+p.y)).size,cells.length);
    for(let i=1;i<cells.length;i++) assert.equal(Math.abs(cells[i].x-cells[i-1].x)+Math.abs(cells[i].y-cells[i-1].y),40);
    assert.deepEqual(cells.at(-1),end);
  }
});
test('previous expanded map saves migrate to the larger world', () => {
 const {w}=setup(), s=structuredClone(w.snapshot());
 s.mapScale=2;
 for(const p of [...s.entities,...s.points,s.base,s.enemyBase]) {p.x/=1.5;p.y/=1.5;}
 const restored=setup().w; assert(restored.restore(s));
 assert.deepEqual(restored.base,w.base);
});

test('squad transfer appends, moves membership, rejects enemies and survives saves', () => {
 const {w,bus}=setup(), squads=new SquadService(w,bus);
 const [a,b,c]=w.units(0).map(e=>e.id);
 squads.assign(1,[a,b]); squads.assign(2,[c]);
 assert(squads.transfer(2,[a,a]));
 assert.deepEqual(squads.members(1),[b]);
 assert.deepEqual(squads.members(2),[c,a]);
 assert(!squads.transfer(2,[w.units(1)[0].id,w.buildings(0)[0].id]));
 assert(!squads.transfer(10,[b]));
 squads.remove(2,[a]);
 assert.deepEqual(squads.members(2),[c]);
 const restored=setup().w; restored.restore(w.snapshot());
 assert.deepEqual(new SquadService(restored,restored.bus).members(2),[c]);
 squads.remove(2,[c]); assert.deepEqual(squads.members(2),[]);
});
