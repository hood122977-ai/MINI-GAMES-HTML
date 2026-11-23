import * as T from '../vendor/three.module.js';
import { ModelFactory } from './models.js';
import { SoftwareRenderer } from './software-renderer.js';
import { DEFINITIONS as D } from './core.js';
const cache = new Map();
export function modelPreview(type) {
  if (cache.has(type)) return cache.get(type);
  const canvas = document.createElement('canvas'),
    scene = new T.Scene(),
    camera = new T.OrthographicCamera(-80, 80, 65, -65, 1, 1000);
  camera.position.set(120, 150, 170);
  camera.lookAt(0, D[type].building ? 30 : 15, 0);
  camera.updateMatrixWorld();
  const factory = new ModelFactory(),
    model = factory.create(type);
  model.userData.dynamic = true;
  if (!D[type].building) model.scale.setScalar(type === 'ram' ? 1.6 : 2);
  scene.add(model);
  const renderer = new SoftwareRenderer(canvas);
  renderer.setPixelRatio(1);
  renderer.setSize(160, 130);
  renderer.render(scene, camera);
  const url = canvas.toDataURL();
  cache.set(type, url);
  model.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
  return url;
}
export function statHTML(type) {
  const d = D[type],
    rows = [['체력', d.hp.toLocaleString()]];
  if (d.dmg)
    rows.push(
      ['공격력', `${d.dmg}${type === 'ram' ? ' (건물 ×4)' : ''}`],
      ['공격 간격', `${d.cooldown}초`],
      ['사거리', `${d.range}`],
    );
  if (d.speed) rows.push(['이동 속도', `${d.speed}`]);
  if (d.time) rows.push(['훈련 시간', `${d.time}초`]);
  if (d.vision) rows.push(['영향 반경', `${d.vision}`]);
  if (d.g !== undefined) rows.push(['필요 자원', `금 ${d.g} · 합금 ${d.w}`]);
  if (type === 'mine') rows.push(['초당 생산', '금 +8 · 합금 +5']);
  if (type === 'barracks') rows.push(['훈련 대기열', '최대 8기']);
  return `<div class="tooltip-heading"><img src="${modelPreview(type)}" alt=""><div><small>${d.tag}</small><strong>${d.name}</strong></div></div><p>${d.desc || '본진의 핵심 건물. 파괴되면 전투에서 패배합니다.'}</p><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}
export class StatTooltip {
  constructor() {
    this.el = document.getElementById('statTooltip');
    document.addEventListener('pointerover', (e) => {
      let b = e.target.closest('[data-type]');
      if (b && D[b.dataset.type]) this.show(b);
    });
    document.addEventListener('pointerout', (e) => {
      let b = e.target.closest('[data-type]');
      if (b && !b.contains(e.relatedTarget)) this.hide();
    });
    document.addEventListener('focusin', (e) => {
      let b = e.target.closest('[data-type]');
      if (b && D[b.dataset.type]) this.show(b);
    });
    document.addEventListener('focusout', () => this.hide());
    document.addEventListener('pointerdown', () => this.hide());
  }
  show(button) {
    this.el.innerHTML = statHTML(button.dataset.type);
    this.el.hidden = false;
    let r = button.getBoundingClientRect(),
      h = this.el.offsetHeight,
      w = this.el.offsetWidth;
    this.el.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left)) + 'px';
    this.el.style.top =
      Math.max(
        10,
        r.top > h + 20 ? r.top - h - 12 : Math.min(innerHeight - h - 10, r.bottom + 10),
      ) + 'px';
  }
  hide() {
    this.el.hidden = true;
  }
}
