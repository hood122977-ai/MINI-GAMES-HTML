import { biomeAt, BIOMES, BRIDGES, REGIONS, nearestRegion } from './geography.js';
import { SoftwareRenderer } from './software-renderer.js';
import * as T from '../vendor/three.module.js';
import { MAP, DEFINITIONS as D, isLand, distance } from './core.js';
import { ModelFactory, material, COLORS } from './models.js';
export class BattlefieldRenderer {
  constructor(canvas, overlay, world, territory, bus) {
    Object.assign(this, { canvas, overlay, world, territory, bus });
    this.ctx = overlay.getContext('2d');
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#173c4d');
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    this.renderer = gl
      ? new T.WebGLRenderer({
          canvas,
          context: gl,
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        })
      : new SoftwareRenderer(canvas);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.camera = new T.OrthographicCamera(-600, 600, 400, -400, 1, 6000);
    this.focus = new T.Vector3(world.base.x + 160, 0, world.base.y + 60);
    this.span = 1060;
    this.yaw = 0.12;
    this.models = new Map();
    this.factory = new ModelFactory();
    this.ray = new T.Raycaster();
    this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    this.effects = [];
    this.ghost = null;
    this.lastTerritory = -1;
    this.scene.add(new T.HemisphereLight(0xd9f2ff, 0x5a6536, 2.4));
    const sun = new T.DirectionalLight(0xffefd3, 3.1);
    sun.position.set(-500, 3300, -900);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -3400,
      right: 3400,
      top: 2800,
      bottom: -2800,
      far: 9000,
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 1.5;
    sun.target.position.set(MAP.w / 2, 0, MAP.h / 2);
    this.scene.add(sun, sun.target);
    this.makeTerrain();
    bus.on('shot', (e) => this.shot(e));
    bus.on('order', (e) => this.order(e));
    bus.on('destroyed', (e) => this.explosion(e));
    bus.on('reset', () => {
      for (const m of this.models.values()) this.scene.remove(m);
      this.models.clear();
      this.lastTerritory = -1;
    });
    this.resize();
  }
  resize() {
    let r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.w = r.width;
    this.h = r.height;
    this.renderer.setSize(this.w, this.h, false);
    this.overlay.width = Math.round(this.w * devicePixelRatio);
    this.overlay.height = Math.round(this.h * devicePixelRatio);
    this.updateCamera();
  }
  updateCamera() {
    const aspect = this.w / this.h,
      hh = this.span / aspect / 2;
    this.camera.left = -this.span / 2;
    this.camera.right = this.span / 2;
    this.camera.top = hh;
    this.camera.bottom = -hh;
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * 1200,
      1500,
      this.focus.z + Math.cos(this.yaw) * 1200,
    );
    this.camera.lookAt(this.focus);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  pan(dx, dy, dt) {
    const s = this.span * 0.65 * dt;
    this.focus.x += (dx * Math.cos(this.yaw) + dy * Math.sin(this.yaw)) * s;
    this.focus.z += (-dx * Math.sin(this.yaw) + dy * Math.cos(this.yaw)) * s;
    this.focus.x = T.MathUtils.clamp(this.focus.x, 100, MAP.w - 100);
    this.focus.z = T.MathUtils.clamp(this.focus.z, 100, MAP.h - 100);
    this.updateCamera();
  }
  zoom(delta) {
    this.span = T.MathUtils.clamp(this.span * (delta > 0 ? 1.1 : 0.91), 550, 16000);
    this.updateCamera();
  }
  home() {
    this.focus.set(this.world.base.x + 160, 0, this.world.base.y + 60);
    this.span = 1060;
    this.updateCamera();
  }
  point(x, y) {
    this.ray.setFromCamera(new T.Vector2((x / this.w) * 2 - 1, 1 - (y / this.h) * 2), this.camera);
    let p = new T.Vector3();
    return this.ray.ray.intersectPlane(this.plane, p) ? { x: p.x, y: p.z } : null;
  }
  screen(x, y, height = 0) {
    const v = new T.Vector3(x, height, y).project(this.camera);
    return {
      x: ((v.x + 1) * this.w) / 2,
      y: ((1 - v.y) * this.h) / 2,
      visible: v.z < 1 && v.z > -1,
    };
  }
  pick(x, y) {
    let best = null,
      score = Infinity;
    for (const e of this.world.entities) {
      const p = this.screen(e.x, e.y, D[e.type].building ? 28 : 17),
        r = Math.max(15, (e.r * this.w) / this.span),
        d = Math.hypot(p.x - x, p.y - y);
      if (d < r + 12 && d < score) {
        best = e;
        score = d;
      }
    }
    return best;
  }
  makeTerrain() {
    let geo = new T.PlaneGeometry(32000, 32000);
    let sea = new T.Mesh(geo, material(0x24566b, 0, 0.4));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(MAP.w / 2, -17, MAP.h / 2);
    sea.receiveShadow = true;
    sea.userData.background = true;
    this.scene.add(sea);
    const positions = [],
      colors = [];
    const step = 120;
    for (let z = 0; z < MAP.h; z += step)
      for (let x = 0; x < MAP.w; x += step) {
        if (!isLand(x + step / 2, z + step / 2)) continue;
        let coast = !isLand(x + step / 2, z + step / 2, 40),
          noise = (Math.sin(x * 0.039 + z * 0.061) + Math.cos(z * 0.071 - x * 0.021)) * 0.018;
        const c = new T.Color(coast ? 0xb8b08c : BIOMES[biomeAt(x, z)].color);
        c.offsetHSL(0, 0, noise);
        let points = [
          [x, 0, z],
          [x + step, 0, z],
          [x + step, 0, z + step],
          [x, 0, z],
          [x + step, 0, z + step],
          [x, 0, z + step],
        ];
        points.forEach((p) => {
          positions.push(...p);
          colors.push(c.r, c.g, c.b);
        });
        if (coast) {
          const cliff = new T.Mesh(new T.BoxGeometry(step, 13, step), material(0x8e8c6e));
          cliff.position.set(x + step / 2, -7, z + step / 2);
          cliff.receiveShadow = true;
          this.scene.add(cliff);
        }
      }
    let groundGeo = new T.BufferGeometry();
    groundGeo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    groundGeo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
    const ground = new T.Mesh(
      groundGeo,
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide }),
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    let seed = 71;
    const rnd = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const reserved = [
      ...this.world.entities,
      ...this.world.points,
      ...REGIONS.flatMap((r) => [
        { ...r.base },
        { x: r.base.x + 140, y: r.base.y + 100 },
        { x: r.base.x - 120, y: r.base.y + 130 },
      ]),
    ];
    let trees = [];
    for (let i = 0; i < 1400; i++) {
      let x = rnd() * MAP.w,
        z = rnd() * MAP.h;
      if (
        !isLand(x, z, 70) ||
        ['desert', 'bridge'].includes(biomeAt(x, z)) ||
        reserved.some((e) => distance(e, { x, y: z }) < 130) ||
        Math.sin(x / 155) + Math.cos(z / 170) < 0.5
      )
        continue;
      trees.push({ x, z, s: 0.65 + rnd() * 0.7 });
    }
    const trunks = new T.InstancedMesh(
        new T.CylinderGeometry(3, 4, 20, 5),
        material(0x6a5d41),
        trees.length,
      ),
      leaves = new T.InstancedMesh(new T.ConeGeometry(19, 48, 6), material(0x3c704a), trees.length);
    let dummy = new T.Object3D();
    trees.forEach((t, i) => {
      dummy.position.set(t.x, 10 * t.s, t.z);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 38 * t.s;
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    });
    trunks.castShadow = true;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    this.scene.add(trunks, leaves);
    for (let i = 0; i < 170; i++) {
      let x = rnd() * MAP.w,
        z = rnd() * MAP.h;
      if (!isLand(x, z, 30) || reserved.some((e) => distance(e, { x, y: z }) < 110)) continue;
      let rock = new T.Mesh(new T.DodecahedronGeometry(6 + rnd() * 12, 0), material(0x83918a));
      rock.position.set(x, 3, z);
      rock.scale.set(1.4, 0.6, 1);
      rock.castShadow = true;
      this.scene.add(rock);
    }
    // Bridges make every province reachable by ground units.
    for (const b of BRIDGES) {
      const deck = new T.Mesh(new T.BoxGeometry(b.w, 8, b.h), material(0x8b9692));
      deck.position.set(b.x, -3, b.y);
      deck.receiveShadow = true;
      this.scene.add(deck);
      const horizontal = b.w > b.h;
      for (const side of [-1, 1]) {
        const rail = new T.Mesh(
          new T.BoxGeometry(horizontal ? b.w : 4, 11, horizontal ? 4 : b.h),
          material(0x526a70),
        );
        rail.position.set(
          b.x + (horizontal ? 0 : (side * b.w) / 2),
          5,
          b.y + (horizontal ? (side * b.h) / 2 : 0),
        );
        this.scene.add(rail);
      }
    }
    for (let i = 0; i < 38; i++) {
      let x = 750 + i * 28,
        y = 360 + Math.sin(i * 0.8) * 55;
      if (!isLand(x, y, 45)) continue;
      let peak = new T.Mesh(
        new T.ConeGeometry(55 + (i % 3) * 16, 100 + (i % 4) * 28, 5),
        material(i % 3 ? 0xa9b9b8 : 0xd9e2df),
      );
      peak.position.set(x, 45, y);
      peak.castShadow = true;
      this.scene.add(peak);
    }
    this.pointModels = [];
    for (const p of this.world.points) {
      let g = new T.Group();
      this.factory.base(g, 33);
      this.factory.cyl(g, 0, 22, 0, 7, 14, 30, COLORS.white, 8);
      this.factory.cyl(g, 0, 50, 0, 2, 2, 45, COLORS.dark, 6);
      let flag = this.factory.box(g, 13, 66, 0, 24, 13, 2, COLORS.gold);
      let ring = this.factory.ring(g, 0, 2, 0, 95, COLORS.gold);
      g.position.set(p.x, 0, p.y);
      this.scene.add(g);
      this.pointModels.push({ g, flag, ring });
    }
    this.borderGroup = new T.Group();
    this.scene.add(this.borderGroup);
  }
  territoryGeometry() {
    if (this.lastTerritory === this.world.revision) return;
    this.lastTerritory = this.world.revision;
    for (const m of [...this.borderGroup.children]) {
      m.geometry.dispose();
      m.material.dispose();
      this.borderGroup.remove(m);
    }
    const cells = this.territory.cells,
      lookup = new Map(cells.map((c) => [c.x + ',' + c.y, c.owner]));
    for (let team = 0; team < 2; team++) {
      let p = [],
        edges = [];
      for (const c of cells) {
        if (c.owner !== team) continue;
        const x = c.x - 40,
          z = c.y - 40;
        for (const v of [
          [x, 1, z],
          [x + 80, 1, z],
          [x + 80, 1, z + 80],
          [x, 1, z],
          [x + 80, 1, z + 80],
          [x, 1, z + 80],
        ])
          p.push(...v);
        for (const [dx, dy, a, b] of [
          [-80, 0, [x, 2, z], [x, 2, z + 80]],
          [80, 0, [x + 80, 2, z], [x + 80, 2, z + 80]],
          [0, -80, [x, 2, z], [x + 80, 2, z]],
          [0, 80, [x, 2, z + 80], [x + 80, 2, z + 80]],
        ])
          if (lookup.get(c.x + dx + ',' + (c.y + dy)) !== team) edges.push(...a, ...b);
      }
      let g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      this.borderGroup.add(
        new T.Mesh(
          g,
          new T.MeshBasicMaterial({
            color: team ? COLORS.red : COLORS.blue,
            opacity: 0.11,
            transparent: true,
            depthWrite: false,
            side: T.DoubleSide,
          }),
        ),
      );
      let l = new T.BufferGeometry();
      l.setAttribute('position', new T.Float32BufferAttribute(edges, 3));
      this.borderGroup.add(
        new T.LineSegments(
          l,
          new T.LineBasicMaterial({
            color: team ? 0xff9a7d : 0x83d9ff,
            transparent: true,
            opacity: 0.85,
          }),
        ),
      );
    }
  }
  shot(e) {
    let geo = new T.BufferGeometry().setFromPoints([
      new T.Vector3(e.from.x, 23, e.from.y),
      new T.Vector3(e.to.x, 19, e.to.y),
    ]);
    let line = new T.Line(
      geo,
      new T.LineBasicMaterial({ color: e.team ? 0xff9e64 : 0xa9f6ff, transparent: true }),
    );
    line.userData.dynamic = true;
    this.scene.add(line);
    this.effects.push({ m: line, ttl: 0.18, max: 0.18, kind: 'shot' });
  }
  order(e) {
    let m = new T.Mesh(
      new T.RingGeometry(15, 18, 32),
      new T.MeshBasicMaterial({
        color: e.attack ? 0xffb56b : 0x99e5ff,
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(e.x, 3, e.y);
    m.userData.dynamic = true;
    this.scene.add(m);
    this.effects.push({ m, ttl: 0.9, max: 0.9, kind: 'ring' });
  }
  explosion(e) {
    let m = new T.Mesh(
      new T.IcosahedronGeometry(e.r, 1),
      new T.MeshBasicMaterial({ color: 0xffc879, transparent: true, wireframe: true }),
    );
    m.position.set(e.x, 20, e.y);
    m.userData.dynamic = true;
    this.scene.add(m);
    this.effects.push({ m, ttl: 0.6, max: 0.6, kind: 'ring' });
  }
  setGhost(type, p) {
    if (this.ghost?.userData.type !== type) {
      if (this.ghost) {
        this.scene.remove(this.ghost);
        this.ghost.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        });
      }
      this.ghost = null;
      if (type) {
        this.ghost = this.factory.create(type);
        this.ghost.userData.type = type;
        this.ghost.userData.dynamic = true;
        this.ghost.traverse((o) => {
          if (o.isMesh) {
            o.material = o.material.clone();
            o.material.transparent = true;
            o.material.opacity = 0.5;
            o.castShadow = false;
          }
        });
        this.scene.add(this.ghost);
      }
    }
    if (this.ghost && p) {
      this.ghost.visible = true;
      this.ghost.position.set(p.x, 2, p.y);
      this.ghost.traverse((o) => {
        if (o.isMesh) o.material.color.set(p.ok ? 0x88e9d2 : 0xff7364);
      });
    } else if (this.ghost) this.ghost.visible = false;
  }
  render(dt, selection, input) {
    if (this.w !== this.canvas.clientWidth || this.h !== this.canvas.clientHeight) this.resize();
    const ids = new Set(this.world.entities.map((e) => e.id));
    for (const [id, m] of this.models)
      if (!ids.has(id)) {
        this.scene.remove(m);
        this.models.delete(id);
      }
    for (const e of this.world.entities) {
      let g = this.models.get(e.id);
      if (!g) {
        g = this.factory.create(e.type, e.team);
        g.userData.dynamic = true;
        let sel = new T.Mesh(
          new T.RingGeometry(e.r + 7, e.r + 10, 40),
          new T.MeshBasicMaterial({
            color: e.team ? 0xff9984 : 0x8ef1ff,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        sel.rotation.x = -Math.PI / 2;
        sel.position.y = 2;
        g.add(sel);
        g.userData.selection = sel;
        let shadow = new T.Mesh(
          new T.CircleGeometry(e.r * 1.3, 24),
          new T.MeshBasicMaterial({
            color: 0x0e211e,
            transparent: true,
            opacity: 0.2,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(7, 1, 7);
        g.add(shadow);
        this.scene.add(g);
        this.models.set(e.id, g);
      }
      g.position.set(e.x, 0, e.y);
      if (!D[e.type].building) {
        g.rotation.y = e.angle;
        g.position.y =
          e.moving && e.type !== 'ram' ? Math.sin(this.world.time * 17 + e.id) * 1.3 : 0;
      }
      if (g.userData.rotor) g.userData.rotor.rotation.y += dt * 2;
      if (g.userData.turret) g.userData.turret.rotation.y = e.angle;
      g.userData.selection.visible = selection.has(e.id);
    }
    // Physical walls define the visible boundary; no territory tint.
    this.world.points.forEach((p, i) => {
      let c = p.owner < 0 ? COLORS.gold : p.owner ? COLORS.red : COLORS.blue;
      this.pointModels[i].flag.material = material(c);
      this.pointModels[i].ring.material = material(c);
    });
    for (const e of this.effects) {
      e.ttl -= dt;
      e.m.material.opacity = Math.max(0, e.ttl / e.max);
      if (e.kind === 'ring') e.m.scale.setScalar(1 + (1 - e.ttl / e.max) * 1.5);
    }
    this.effects = this.effects.filter((e) => {
      if (e.ttl > 0) return true;
      this.scene.remove(e.m);
      e.m.geometry.dispose();
      e.m.material.dispose();
      return false;
    });
    this.renderer.revision = this.world.revision;
    this.renderer.render(this.scene, this.camera);
    this.drawHUD(selection, input);
    const region = nearestRegion(this.focus.x, this.focus.z);
    document.querySelector('.map-caption h1').textContent = region.name;
    document.querySelector('.map-caption .eyebrow').textContent = region.en;
  }
  drawHUD(selection, input) {
    const c = this.ctx;
    c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    for (const e of this.world.entities) {
      const selected = selection.has(e.id),
        building = D[e.type].building;
      if (!selected && !building && e.hp >= e.maxhp) continue;
      if (e.type === 'wall' && !selected && e.hp === e.maxhp) continue;
      let p = this.screen(e.x, e.y, building ? (e.type === 'hq' ? 110 : 80) : 49);
      if (p.x < 0 || p.y < 0 || p.x > this.w || p.y > this.h) continue;
      const label = building ? D[e.type].name : '',
        width = building ? Math.max(62, label.length * 13 + 16) : 36;
      c.font = '600 12px sans-serif';
      c.textAlign = 'center';
      if (building) {
        c.fillStyle = '#0c1d2be8';
        c.fillRect(p.x - width / 2, p.y - 17, width, 21);
        c.fillStyle = '#f6fbff';
        c.fillText(label, p.x, p.y - 2);
      }
      c.fillStyle = '#091826';
      c.fillRect(p.x - width / 2 - 1, p.y + 6, width + 2, 5);
      c.fillStyle = e.team ? '#ff826a' : '#66caff';
      c.fillRect(p.x - width / 2, p.y + 7, (width * e.hp) / e.maxhp, 3);
      if (e.queue.length) {
        c.fillStyle = '#102133';
        c.fillRect(p.x - width / 2, p.y + 14, width, 4);
        c.fillStyle = '#ffd182';
        c.fillRect(
          p.x - width / 2,
          p.y + 14,
          width * Math.min(1, e.progress / D[e.queue[0]].time),
          4,
        );
      }
    }
    for (const p of this.world.points) {
      let v = this.screen(p.x, p.y, 95);
      c.font = '600 12px sans-serif';
      c.textAlign = 'center';
      let text = p.name + (p.owner < 0 ? ' · 중립' : p.owner ? ' · 적 점령' : ' · 아군');
      c.fillStyle = '#142838e8';
      c.fillRect(v.x - 64, v.y - 18, 128, 24);
      c.fillStyle = p.owner < 0 ? '#ffe0a0' : p.owner ? '#ffae9c' : '#9ee5ff';
      c.fillText(text, v.x, v.y - 2);
      if (p.progress > 0) {
        c.fillStyle = '#ffdb7e';
        c.fillRect(v.x - 55, v.y + 9, (110 * p.progress) / 7, 5);
      }
    }
    if (input?.drag && !input.drag.build) {
      let d = input.drag,
        m = input.mouse;
      c.fillStyle = '#6dcfff25';
      c.strokeStyle = '#a9e8ff';
      c.lineWidth = 1.5;
      c.fillRect(d.x, d.y, m.x - d.x, m.y - d.y);
      c.strokeRect(d.x, d.y, m.x - d.x, m.y - d.y);
    }
    if (input?.mode === 'attack') {
      c.font = 'bold 14px sans-serif';
      c.fillStyle = '#ffe3a4';
      c.textAlign = 'left';
      c.fillText('공격 이동 지점 선택', input.mouse.x + 18, input.mouse.y - 14);
    }
  }
  drawMinimap(canvas) {
    const c = canvas.getContext('2d'),
      w = canvas.width,
      h = canvas.height;
    const sx = w / MAP.w,
      sy = h / MAP.h;
    if (!this.minimapTerrain) {
      this.minimapTerrain = document.createElement('canvas');
      this.minimapTerrain.width = w;
      this.minimapTerrain.height = h;
      const bg = this.minimapTerrain.getContext('2d');
      bg.fillStyle = '#133647';
      bg.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (isLand(x / sx, y / sy)) {
            bg.fillStyle = BIOMES[biomeAt(x / sx, y / sy)].css;
            bg.fillRect(x, y, 1, 1);
          }
    }
    c.drawImage(this.minimapTerrain, 0, 0);
    for (const p of this.world.points) {
      c.fillStyle = p.owner < 0 ? '#f8d37c' : p.owner ? '#ff8d75' : '#9be4ff';
      c.fillRect(p.x * sx - 3, p.y * sy - 3, 6, 6);
    }
    for (const e of this.world.entities) {
      c.fillStyle = e.team ? '#ffa187' : '#b4f1ff';
      let s = D[e.type].building ? 4 : 2;
      c.fillRect(e.x * sx - s / 2, e.y * sy - s / 2, s, s);
    }
    c.strokeStyle = '#e9f9ff';
    c.lineWidth = 1;
    c.beginPath();
    [
      [0, 0],
      [this.w, 0],
      [this.w, this.h],
      [0, this.h],
    ].forEach(([x, y], i) => {
      let p = this.point(x, y);
      if (p) {
        if (i) c.lineTo(p.x * sx, p.y * sy);
        else c.moveTo(p.x * sx, p.y * sy);
      }
    });
    c.closePath();
    c.stroke();
  }
}
