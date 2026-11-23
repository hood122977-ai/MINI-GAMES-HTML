import { EventBus, EntityFactory, World, SaveRepository } from './core.js';
import {
  Navigation,
  EconomySystem,
  TrainingSystem,
  CombatSystem,
  MovementSystem,
  TerritorySystem,
  EnemyDirector,
  CommandDispatcher,
} from './systems.js';
import { BattlefieldRenderer } from './renderer.js';
import { InputController } from './input.js';
import { HUD } from './ui.js';
/** Lazy game composition root. Menu scenes do not tick or render the battlefield. */
export function createGame(onMain) {
  const bus = new EventBus(),
    world = new World(new EntityFactory(), bus),
    saves = new SaveRepository(localStorage),
    nav = new Navigation(world),
    territory = new TerritorySystem(),
    commands = new CommandDispatcher(world, { nav });
  territory.update(world, 1);
  const renderer = new BattlefieldRenderer(
    document.getElementById('scene'),
    document.getElementById('labels'),
    world,
    territory,
    bus,
  );
  const session = {
    active: true,
    started: true,
    paused: false,
    start() {
      this.started = true;
      this.paused = false;
    },
    toggle() {
      if (!this.active || world.ended) return;
      this.paused = !this.paused;
    },
    reset() {
      world.reset();
      territory.update(world, 1);
      renderer.home();
      this.started = true;
      this.paused = false;
      saves.save(world);
    },
    leave() {
      if (!world.ended) saves.save(world);
      this.paused = true;
      this.active = false;
      document.getElementById('helpModal').hidden = true;
      document.getElementById('endModal').hidden = true;
      onMain();
    },
  };
  bus.on('togglePause', () => session.toggle());
  bus.on('end', (result) => {saves.clear();window.Scores?.save('ironmarch',result.winner===0?1:0,(result.winner===0?'승리':'패배')+' · '+Math.floor(result.time)+'초 · 공세 '+result.wave,'승');});
  const input = new InputController(
      document.getElementById('scene'),
      renderer,
      world,
      commands,
      bus,
      () => session.active && session.started && !session.paused && !world.ended,
    ),
    hud = new HUD(world, input, renderer, territory, commands, bus, session);
  const systems = [
    new EconomySystem(),
    new TrainingSystem(nav),
    new EnemyDirector(nav),
    new CombatSystem(nav),
    new MovementSystem(nav),
    territory,
  ];
  let previous = performance.now(),
    accumulator = 0,
    saveTimer = 0;
  function frame(now) {
    let dt = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    if (session.active) {
      input.update(dt);
      if (!session.paused && !world.ended) {
        accumulator += dt;
        while (accumulator >= 1 / 30) {
          world.time += 1 / 30;
          for (const system of systems) system.update(world, 1 / 30);
          accumulator -= 1 / 30;
          if (world.ended) break;
        }
        saveTimer += dt;
        if (saveTimer > 5) {
          if (!world.ended) saves.save(world);
          saveTimer = 0;
        }
      } else accumulator = 0;
      renderer.render(dt, input.selection, input);
      hud.update(dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('beforeunload', () => {
    if (session.started && !world.ended) saves.save(world);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session.active) {
      session.paused = true;
      if (!world.ended) saves.save(world);
    }
  });
  return {
    world,
    session,
    newCampaign(region) {
      window.Scores?.start('ironmarch');
      world.reset(region);
      territory.update(world, 1);
      input.selection.clear();
      input.cancel();
      renderer.resize();
      renderer.home();
      session.active = true;
      session.started = true;
      session.paused = false;
      saves.save(world);
      bus.emit('notice', '원정 시작 · 거점을 확보하고 적 사령부를 함락하세요.');
    },
    resume(snapshot) {
      window.Scores?.start('ironmarch');
      world.restore(snapshot);
      bus.emit('reset');
      territory.update(world, 1);
      renderer.resize();
      renderer.home();
      session.active = true;
      session.started = true;
      session.paused = false;
      bus.emit('notice', '저장된 작전과 부대 편성을 불러왔습니다.');
    },
    suspend() {
      session.active = false;
      session.paused = true;
      input.keys = {};
      input.cancel();
      if (!world.ended) saves.save(world);
    },
  };
}
