import * as T from '../vendor/three.module.js';
const materials = new Map();
export function material(color, metalness = 0.2, roughness = 0.65) {
  let key = color + ':' + metalness;
  if (!materials.has(key))
    materials.set(key, new T.MeshStandardMaterial({ color, metalness, roughness }));
  return materials.get(key);
}
export const COLORS = {
  blue: 0x28a2ee,
  red: 0xeb6552,
  white: 0xd4e1e7,
  dark: 0x293b4a,
  steel: 0x697d88,
  gold: 0xf4bd59,
};
/** Factory registry keeps new models independent of the renderer lifecycle. */
export class ModelFactory {
  constructor() {
    this.builders = new Map([
      ['hq', this.hq],
      ['mine', this.mine],
      ['barracks', this.barracks],
      ['tower', this.tower],
      ['wall', this.wall],
      ['outpost', this.outpost],
      ['sword', this.soldier],
      ['bow', this.soldier],
      ['ram', this.ram],
    ]);
  }
  create(type, team = 0) {
    const g = new T.Group();
    g.userData.team = team;
    g.userData.color = team ? COLORS.red : COLORS.blue;
    this.builders.get(type).call(this, g, type);
    return g;
  }
  mesh(g, geo, color, x, y, z) {
    const m = new T.Mesh(geo, material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  box(g, x, y, z, w, h, d, c) {
    return this.mesh(g, new T.BoxGeometry(w, h, d), c, x, y, z);
  }
  cyl(g, x, y, z, rt, rb, h, c, n = 12) {
    return this.mesh(g, new T.CylinderGeometry(rt, rb, h, n), c, x, y, z);
  }
  ring(g, x, y, z, r, c) {
    let m = this.mesh(g, new T.TorusGeometry(r, 2, 5, 32), c, x, y, z);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  base(g, r) {
    this.cyl(g, 0, 5, 0, r + 7, r + 10, 10, COLORS.dark, 8);
    this.cyl(g, 0, 12, 0, r, r + 3, 6, COLORS.steel, 8);
  }
  light(g, x, y, z, w = 6) {
    return this.box(g, x, y, z, w, 3, 3, 0xa5f6ff);
  }
  hq(g) {
    let c = g.userData.color;
    this.base(g, 49);
    this.cyl(g, 0, 26, 0, 38, 43, 28, COLORS.white);
    this.cyl(g, 0, 43, 0, 32, 37, 8, c);
    this.cyl(g, 0, 51, 0, 24, 30, 12, COLORS.dark);
    this.cyl(g, 0, 58, 0, 23, 24, 6, c);
    this.cyl(g, 0, 62, 0, 12, 20, 4, COLORS.white);
    for (let a = 0; a < 6; a++) {
      let angle = (a * Math.PI) / 3;
      const wing = new T.Group();
      wing.rotation.y = angle;
      g.add(wing);
      this.box(wing, 0, 20, 42, 19, 24, 22, COLORS.white);
      this.box(wing, 0, 34, 43, 13, 5, 20, c);
      this.box(wing, 0, 22, 54, 11, 12, 2, COLORS.dark);
      this.light(wing, 0, 34, 55, 11);
    }
    this.cyl(g, 0, 78, 0, 1.5, 1.5, 31, COLORS.steel, 6);
    this.cyl(g, 0, 94, 0, 4, 4, 4, 0x98edff);
    this.ring(g, 0, 14, 0, 46, c);
  }
  mine(g) {
    let c = g.userData.color;
    this.base(g, 31);
    this.cyl(g, -9, 24, 0, 20, 25, 24, COLORS.white);
    this.cyl(g, -9, 39, 0, 20, 20, 7, c);
    this.cyl(g, -9, 46, 0, 15, 17, 8, COLORS.dark);
    let fan = new T.Group();
    fan.position.set(-9, 51, 0);
    g.add(fan);
    for (let i = 0; i < 4; i++) {
      let m = this.box(fan, 0, 0, 0, 4, 2, 26, COLORS.steel);
      m.rotation.y = (i * Math.PI) / 4;
    }
    g.userData.rotor = fan;
    for (let z of [-18, 18]) {
      this.cyl(g, 24, 24, z, 9, 10, 30, COLORS.gold);
      this.cyl(g, 24, 41, z, 9, 9, 5, COLORS.dark);
      this.box(g, 24, 25, z + 9, 3, 17, 2, c);
    }
    this.ring(g, -9, 43, 0, 17, 0x80e5ec);
  }
  barracks(g) {
    let c = g.userData.color;
    this.base(g, 37);
    this.box(g, 0, 24, 0, 60, 34, 58, COLORS.white);
    this.box(g, 0, 44, 0, 66, 8, 62, c);
    this.box(g, 0, 53, -7, 44, 10, 40, COLORS.steel);
    this.box(g, 0, 26, 30, 36, 25, 3, COLORS.dark);
    for (let x of [-25, 25]) {
      this.box(g, x, 26, 34, 8, 35, 10, c);
      this.light(g, x, 43, 40, 7);
    }
    this.box(g, 0, 10, 46, 37, 5, 24, COLORS.steel);
    for (let x of [-13, 0, 13]) this.box(g, x, 13, 45, 2, 1, 21, 0x9fcbd0);
    this.box(g, 0, 60, -8, 5, 3, 20, 0xf7eee0);
    this.box(g, 0, 60, -8, 20, 3, 5, 0xf7eee0);
  }
  tower(g) {
    let c = g.userData.color;
    this.base(g, 26);
    this.cyl(g, 0, 24, 0, 16, 22, 30, COLORS.white, 8);
    this.cyl(g, 0, 43, 0, 22, 17, 12, c, 8);
    let turret = new T.Group();
    turret.position.y = 52;
    g.add(turret);
    this.box(turret, 0, 0, 0, 28, 16, 27, COLORS.steel);
    for (let x of [-7, 7]) {
      this.box(turret, x, 1, 23, 6, 6, 35, COLORS.dark);
      this.box(turret, x, 1, 41, 7, 7, 4, 0x8edce7);
    }
    g.userData.turret = turret;
    this.ring(g, 0, 35, 0, 17, c);
  }
  wall(g) {
    let c = g.userData.color;
    this.box(g, 0, 4, 0, 40, 8, 40, COLORS.dark);
    this.box(g, 0, 22, 0, 36, 32, 34, COLORS.white);
    this.box(g, 0, 41, 0, 40, 7, 38, COLORS.steel);
    this.box(g, 0, 29, 18, 30, 7, 2, c);
    this.box(g, 0, 29, -18, 30, 7, 2, c);
    for (let x of [-15, 15]) this.box(g, x, 48, 0, 9, 8, 38, COLORS.white);
  }
  outpost(g) {
    let c = g.userData.color;
    this.base(g, 24);
    this.cyl(g, 0, 20, 0, 14, 19, 24, COLORS.white, 8);
    this.cyl(g, 0, 36, 0, 14, 14, 8, c, 8);
    this.cyl(g, 0, 60, 0, 2, 3, 48, COLORS.steel, 6);
    let dish = this.mesh(
      g,
      new T.SphereGeometry(15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      c,
      0,
      78,
      0,
    );
    dish.rotation.z = -0.7;
    this.cyl(g, 0, 90, 0, 3, 3, 4, 0xa5f6ff);
  }
  soldier(g, type) {
    let c = g.userData.color;
    this.box(g, -5, 8, 0, 7, 16, 8, COLORS.dark);
    this.box(g, 5, 8, 0, 7, 16, 8, COLORS.dark);
    this.box(g, 0, 21, 0, 19, 16, 13, c);
    this.box(g, -11, 20, 0, 6, 13, 11, COLORS.white);
    this.box(g, 11, 20, 0, 6, 13, 11, COLORS.white);
    this.cyl(g, 0, 34, 0, 7, 8, 10, COLORS.white, 8);
    this.box(g, 0, 34, 7, 11, 4, 2, 0x2d3d48);
    this.box(g, 0, 35, 8, 8, 2, 1, 0x87f5ff);
    this.box(g, 0, 22, -9, 12, 13, 7, COLORS.steel);
    if (type === 'bow') {
      this.box(g, 10, 20, 13, 5, 5, 28, COLORS.dark);
      this.box(g, 10, 23, 12, 4, 4, 7, c);
    } else {
      this.box(g, -13, 19, 8, 4, 21, 16, c);
      this.box(g, 12, 25, 10, 3, 28, 3, 0xe5f4fa);
      this.box(g, 12, 13, 10, 10, 3, 5, COLORS.gold);
    }
  }
  ram(g) {
    let c = g.userData.color;
    for (let x of [-18, 18]) {
      this.box(g, x, 8, 0, 11, 15, 40, COLORS.dark);
      for (let z of [-15, 0, 15]) {
        let m = this.cyl(g, x, 8, z, 6, 6, 12, COLORS.steel, 8);
        m.rotation.z = Math.PI / 2;
      }
    }
    this.box(g, 0, 19, 0, 35, 19, 43, COLORS.white);
    this.box(g, 0, 30, 0, 28, 7, 34, c);
    this.cyl(g, 0, 37, 0, 13, 17, 10, COLORS.steel, 8);
    this.box(g, 0, 42, 20, 10, 8, 43, COLORS.dark);
    this.box(g, 0, 42, 43, 12, 10, 5, c);
    this.light(g, -10, 23, 23);
    this.light(g, 10, 23, 23);
  }
}
