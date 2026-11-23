import {wallStroke} from './walls.js';
import { SelectionService } from './selection.js';
import { SquadService, FORMATIONS } from './formations.js';
import { MAP, DEFINITIONS as D } from './core.js';
import { BuildCommand, MoveCommand, StopCommand, RallyCommand, HoldCommand } from './systems.js';
/** Input states: select, build, attack. All state changes go through commands. */
export class InputController {
  constructor(canvas, renderer, world, commands, bus, isActive) {
    Object.assign(this, { canvas, renderer, world, commands, bus, isActive });
    this.selection = new Set();
    this.selector = new SelectionService(world);
    this.mode = 'select';
    this.formation = 'box';
    this.squads = new SquadService(world, bus);
    this.buildType = null;
    this.drag = null;
    this.mouse = { x: 0, y: 0 };
    this.keys = {};
    this.pointerInside = false;
    this.cameraDrag = null;
    canvas.addEventListener('pointerenter', () => (this.pointerInside = true));
    canvas.addEventListener('pointerleave', () => (this.pointerInside = false));
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', () => {
      this.drag = null;
      this.cameraDrag = null;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.renderer.zoom(e.deltaY);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.drag = null;
    });
    bus.on('reset', () => {
      this.selection.clear();
      this.cancel();
    });
  }
  setMode(mode, type = null) {
    this.mode = mode;
    this.buildType = type;
    this.canvas.style.cursor = mode === 'select' ? 'default' : 'crosshair';
    this.bus.emit('mode', { mode, type });
  }
  cancel() {
    this.setMode('select');
    this.drag = null;
    this.renderer.setGhost(null);
  }
  all() {
    this.bus.emit('squadView', null);
    this.selectType('all');
  }
  selectType(type, additive = false) {
    this.cancel();
    this.selection = this.selector.choose(type, this.selection, additive);
    this.bus.emit('selection');
  }
  selectUnit(id, additive = false) {
    const e = this.world.get(id);
    if (!e || e.team !== 0) return;
    this.cancel();
    if (!additive) this.selection.clear();
    if (additive && this.selection.has(id)) this.selection.delete(id);
    else this.selection.add(id);
    this.bus.emit('selection');
  }
  focusSelection() {
    const es = [...this.selection].map((id) => this.world.get(id)).filter(Boolean);
    if (!es.length) return;
    this.renderer.focus.set(
      es.reduce((s, e) => s + e.x, 0) / es.length,
      0,
      es.reduce((s, e) => s + e.y, 0) / es.length,
    );
    this.renderer.updateCamera();
  }

  stop() {
    if (this.isActive()) this.commands.dispatch(new StopCommand([...this.selection]));
  }
  pos(e) {
    let r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  down(e) {
    if (e.button === 1) {
      e.preventDefault();
      this.mouse = this.pos(e);
      this.cameraDrag = { ...this.mouse };
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (!this.isActive()) return;
    this.mouse = this.pos(e);
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.renderer.point(this.mouse.x, this.mouse.y);
    if (!p) return;
    if (e.button === 2) {
      if (this.mode === 'build') {
        this.cancel();
        return;
      }
      const target = this.renderer.pick(this.mouse.x, this.mouse.y);
      let es = [...this.selection].map((id) => this.world.get(id)).filter(Boolean);
      if (es.length === 1 && es[0].team === 0 && es[0].type === 'barracks') {
        this.commands.dispatch(new RallyCommand(es[0].id, p));
        return;
      }
      this.commands.dispatch(
        new MoveCommand(
          [...this.selection],
          p,
          target?.team === 1 ? target : null,
          this.mode === 'attack',
          this.formation,
        ),
      );
      this.cancel();
      return;
    }
    if (e.button !== 0) return;
    if (this.mode === 'build') {
      this.drag = { ...this.mouse, build: true, lastWall:p, wallSeen:new Set() };
      this.place(p);
      return;
    }
    if (this.mode === 'attack' || this.mode === 'move') {
      this.commands.dispatch(
        new MoveCommand([...this.selection], p, null, this.mode === 'attack', this.formation),
      );
      this.cancel();
      return;
    }
    this.drag = { ...this.mouse, shift: e.shiftKey };
  }
  move(e) {
    this.mouse = this.pos(e);
    if (this.cameraDrag) {
      const a = this.renderer.point(this.cameraDrag.x, this.cameraDrag.y),
        b = this.renderer.point(this.mouse.x, this.mouse.y);
      if (a && b) {
        this.renderer.focus.x += a.x - b.x;
        this.renderer.focus.z += a.y - b.y;
        this.renderer.focus.x = Math.max(0, Math.min(MAP.w, this.renderer.focus.x));
        this.renderer.focus.z = Math.max(0, Math.min(MAP.h, this.renderer.focus.z));
        this.renderer.updateCamera();
      }
      this.cameraDrag = { ...this.mouse };
      return;
    }
    if (this.drag?.build && this.buildType === 'wall' && this.isActive()) {
      let p = this.renderer.point(this.mouse.x, this.mouse.y);
      if (p) this.extendWall(p);
    }
  }
  extendWall(p) {
    if(!this.drag?.build)return;
    for(const cell of wallStroke(this.drag.lastWall,p)){
      const key=`${cell.x},${cell.y}`;if(this.drag.wallSeen.has(key))continue;this.drag.wallSeen.add(key);
      if(this.world.entities.some(e=>e.team===0&&e.type==='wall'&&e.x===cell.x&&e.y===cell.y))continue;
      const preview=BuildCommand.preview(this.world,'wall',cell,[...this.selection]);
      if(!preview.ok){this.bus.emit('notice',preview.reason);continue;}
      this.place(cell,true);
    }
    this.drag.lastWall=p;
  }
  place(p, silent = false) {
    if (!this.buildType) return;
    const ok = this.commands.dispatch(
      new BuildCommand(this.buildType, p, [...this.selection]),
      silent,
    );
    if (ok && this.buildType !== 'wall') this.cancel();
  }
  up(e) {
    if (e.button === 1) {
      this.cameraDrag = null;
      this.canvas.style.cursor = this.mode === 'select' ? 'default' : 'crosshair';
      return;
    }
    if (!this.drag) return;
    this.mouse = this.pos(e);
    if(this.drag.build&&this.buildType==='wall'&&this.isActive()){const p=this.renderer.point(this.mouse.x,this.mouse.y);if(p)this.extendWall(p);}
    if (!this.drag.build) {
      if (!this.drag.shift) this.selection.clear();
      if (Math.hypot(this.mouse.x - this.drag.x, this.mouse.y - this.drag.y) > 7) {
        for (const u of this.world.units(0)) {
          let p = this.renderer.screen(u.x, u.y, 15);
          if (
            p.x >= Math.min(this.mouse.x, this.drag.x) &&
            p.x <= Math.max(this.mouse.x, this.drag.x) &&
            p.y >= Math.min(this.mouse.y, this.drag.y) &&
            p.y <= Math.max(this.mouse.y, this.drag.y)
          )
            this.selection.add(u.id);
        }
      } else {
        const e = this.renderer.pick(this.mouse.x, this.mouse.y);
        if (e) {
          if (this.drag.shift && this.selection.has(e.id)) this.selection.delete(e.id);
          else this.selection.add(e.id);
        }
      }
      this.bus.emit('selection');
    }
    this.drag = null;
  }
  key(e) {
    if (document.querySelector('#squadPicker[open]')) return;
    if (e.target?.matches?.('input, select, textarea, [contenteditable=true]')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
      e.preventDefault();
    this.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'Escape') this.cancel();
    if (e.code === 'Space') this.bus.emit('togglePause');
    if (e.code === 'KeyH') this.renderer.home();
    if (!this.isActive()) return;
    if (e.code === 'KeyQ') this.all();
    if (e.code === 'KeyC') this.focusSelection();
    if (e.code === 'KeyF') {
      if (
        [...this.selection].some((id) => {
          const e = this.world.get(id);
          return e && e.team === 0 && !D[e.type].building;
        })
      )
        this.setMode('attack');
      else this.bus.emit('notice', '먼저 아군 분대를 선택하세요.');
    }
    if (e.code === 'KeyX') this.stop();
    if (e.code === 'KeyV') this.hold();
    let n = Number(e.code.replace('Digit', ''));
    if (n >= 1 && n <= 9) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) this.squads.assign(n, this.selection);
      else this.recall(n);
    }
  }
  hold() {
    if (this.isActive()) this.commands.dispatch(new HoldCommand([...this.selection]));
  }
  recall(number) {
    const ids = this.squads.members(number);
    this.bus.emit('squadView', number);
    this.cancel();
    this.selection = new Set(ids);
    this.focusSelection();
    this.bus.emit('selection');
    this.bus.emit('notice', `${number}분대 선택 · ${ids.length}개 대상`);
  }
  setFormation(kind) {
    if (!FORMATIONS[kind]) return;
    this.formation = kind;
    this.bus.emit('formation', kind);
    this.bus.emit('notice', `${FORMATIONS[kind]} 대열 · 다음 이동 명령부터 적용`);
  }
  update(dt) {
    if (this.isActive()) {
      let dx =
          Number(!!(this.keys.KeyD || this.keys.ArrowRight)) -
          Number(!!(this.keys.KeyA || this.keys.ArrowLeft)),
        dy =
          Number(!!(this.keys.KeyS || this.keys.ArrowDown)) -
          Number(!!(this.keys.KeyW || this.keys.ArrowUp));
      if (this.pointerInside && !this.cameraDrag && !this.drag) {
        const edge = 18;
        dx += this.mouse.x < edge ? -1 : this.mouse.x > this.renderer.w - edge ? 1 : 0;
        dy += this.mouse.y < edge ? -1 : this.mouse.y > this.renderer.h - edge ? 1 : 0;
      }
      if (dx || dy) this.renderer.pan(dx, dy, dt);
    }
    if (this.mode === 'build') {
      let p = this.renderer.point(this.mouse.x, this.mouse.y);
      this.renderer.setGhost(
        this.buildType,
        p ? BuildCommand.preview(this.world, this.buildType, p, [...this.selection]) : null,
      );
    }
    for (const id of this.selection) if (!this.world.get(id)) this.selection.delete(id);
  }
}
