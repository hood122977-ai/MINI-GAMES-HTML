import * as T from '../vendor/three.module.js';
/** Renderer adapter for environments without WebGL. Projects the same 3D meshes. */
export class SoftwareRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.background = document.createElement('canvas');
    this.shadowMap = {};
    this.pixelRatio = 1;
    this.key = '';
    this.revision = 0;
    this.isSoftware = true;
    this.light = new T.Vector3(-0.45, 0.85, -0.4).normalize();
  }
  setPixelRatio(r) {
    this.pixelRatio = Math.min(r, 1.25);
  }
  setSize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.pixelRatio);
    this.canvas.height = Math.round(h * this.pixelRatio);
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    this.key = '';
  }
  project(x, y, z, matrix, camera) {
    let v = new T.Vector3(x, y, z).applyMatrix4(matrix).project(camera);
    return { x: ((v.x + 1) * this.width) / 2, y: ((1 - v.y) * this.height) / 2, z: v.z };
  }
  collect(scene, camera, dynamic) {
    const list = [];
    const identity = new T.Matrix4();
    scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isLine) || o.userData.background) return;
      let d = !!o.userData.dynamic;
      for (let parent = o.parent; parent; parent = parent.parent)
        if (parent.userData.dynamic) d = true;
      if (d !== dynamic) return;
      if (o.isLine) {
        let a = o.geometry.attributes.position,
          m = o.material;
        if (!m?.visible) return;
        const stride = o.isLineSegments ? 2 : 1;
        for (let i = 0; i < a.count - 1; i += stride) {
          let p = this.project(a.getX(i), a.getY(i), a.getZ(i), o.matrixWorld, camera),
            q = this.project(a.getX(i + 1), a.getY(i + 1), a.getZ(i + 1), o.matrixWorld, camera);
          list.push({
            line: true,
            p,
            q,
            z: (p.z + q.z) / 2,
            color: '#' + m.color.getHexString(),
            alpha: m.opacity ?? 1,
          });
        }
        return;
      }
      const draw = (matrix) => {
        const g = o.geometry,
          a = g.attributes.position,
          n = g.index,
          colors = g.attributes.color,
          mat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!a || !mat?.visible || mat.opacity === 0) return;
        const count = n ? n.count : a.count;
        let projected = [];
        for (let i = 0; i < a.count; i++)
          projected.push(this.project(a.getX(i), a.getY(i), a.getZ(i), matrix, camera));
        for (let i = 0; i < count; i += 3) {
          let ia = n ? n.getX(i) : i,
            ib = n ? n.getX(i + 1) : i + 1,
            ic = n ? n.getX(i + 2) : i + 2,
            p = projected[ia],
            q = projected[ib],
            r = projected[ic];
          if (!p || !q || !r) continue;
          if (
            Math.max(p.x, q.x, r.x) < -30 ||
            Math.min(p.x, q.x, r.x) > this.width + 30 ||
            Math.max(p.y, q.y, r.y) < -30 ||
            Math.min(p.y, q.y, r.y) > this.height + 30
          )
            continue;
          const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
          if (mat.side !== T.DoubleSide && cross >= 0) continue;
          if (Math.abs(cross) < 0.08) continue;
          let color = mat.color.clone();
          if (colors && mat.vertexColors)
            color.multiply(new T.Color(colors.getX(ia), colors.getY(ia), colors.getZ(ia)));
          let pa = new T.Vector3(a.getX(ia), a.getY(ia), a.getZ(ia)),
            pb = new T.Vector3(a.getX(ib), a.getY(ib), a.getZ(ib)),
            pc = new T.Vector3(a.getX(ic), a.getY(ic), a.getZ(ic)),
            normal = pb.sub(pa).cross(pc.sub(pa)).normalize().transformDirection(matrix);
          if (mat.side === T.DoubleSide && normal.y < 0) normal.negate();
          if (!mat.isMeshBasicMaterial) {
            let shade = 0.65 + Math.max(0, normal.dot(this.light)) * 0.38;
            color.multiplyScalar(shade);
          }
          list.push({
            p,
            q,
            r,
            z: (p.z + q.z + r.z) / 3,
            color: '#' + color.getHexString(),
            alpha: mat.transparent ? mat.opacity : 1,
            wire: mat.wireframe,
          });
        }
      };
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, identity);
          let m = new T.Matrix4().multiplyMatrices(o.matrixWorld, identity);
          draw(m);
        }
      } else draw(o.matrixWorld);
    });
    return list.sort((a, b) => b.z - a.z);
  }
  draw(ctx, list) {
    ctx.lineJoin = 'round';
    for (const f of list) {
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.moveTo(f.p.x, f.p.y);
      ctx.lineTo(f.q.x, f.q.y);
      if (f.line) {
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        continue;
      }
      ctx.lineTo(f.r.x, f.r.y);
      ctx.closePath();
      if (f.wire) {
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = f.color;
        ctx.fill();
        if (f.alpha === 1) {
          ctx.strokeStyle = f.color;
          ctx.lineWidth = 0.45;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  render(scene, camera) {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    let key =
      camera.matrixWorld.elements.join(',') +
      camera.projectionMatrix.elements.join(',') +
      this.revision;
    if (key !== this.key) {
      this.key = key;
      let c = this.background.getContext('2d');
      c.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      c.fillStyle = '#235368';
      c.fillRect(0, 0, this.width, this.height);
      this.draw(c, this.collect(scene, camera, false));
    }
    const c = this.context;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.background, 0, 0);
    c.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.draw(c, this.collect(scene, camera, true));
  }
}
