import { mountCommandConsole } from './layout.js';
import { AtlasRenderer } from './atlas.js';
import { REGIONS, regionById } from './geography.js';
import { SaveRepository, DEFINITIONS } from './core.js';
import { modelPreview, StatTooltip } from './previews.js';
import { createGame } from './main.js';
const $ = (id) => document.getElementById(id);
/** Scene state machine owns enter/exit; the simulation only runs in GameScene. */
export class SceneManager {
  constructor() {
    mountCommandConsole();
    this.current = 'title';
    this.selected = 'west';
    this.game = null;
    this.saves = new SaveRepository(localStorage);
    this.atlas = new AtlasRenderer();
    this.tooltip = new StatTooltip();
    $('regionPins').innerHTML = REGIONS.map(
      (r, i) =>
        `<button class="region-pin" data-region="${r.id}" style="left:${(r.x / 14400) * 100}%;top:${(r.y / 9600) * 100}%" aria-label="${r.name} 선택"><span class="pin-symbol">${r.icon}</span><b>${r.name}</b><small>${r.tag}</small></button>`,
    ).join('');
    $('regionPins').onclick = (e) => {
      const b = e.target.closest('[data-region]');
      if (b) this.select(b.dataset.region);
    };
    $('enterMain').onclick = () => this.show('main');
    $('toTitle').onclick = () => this.show('title');
    $('deploy').onclick = () => this.launch(false);
    $('titleResume').onclick = () => this.launch(true);
    $('mainResume').onclick = () => this.launch(true);
    $('openCodex').onclick = () => this.openCodex();
    $('closeCodex').onclick = () => {
      $('codexModal').hidden = true;
      this.tooltip.hide();
    };
    window.addEventListener('resize', () => this.draw());
    this.select('west');
    this.show('title');
  }
  select(id) {
    this.selected = id;
    const r = regionById(id);
    $('regionIndex').textContent = `REGION ${String(REGIONS.indexOf(r) + 1).padStart(2, '0')} / 06`;
    $('regionName').textContent = r.name;
    $('regionEnglish').textContent = r.en;
    $('regionBiome').textContent = r.tag;
    $('regionDifficulty').textContent = r.difficulty;
    $('regionSymbol').textContent = r.icon;
    $('regionSymbol').style.color = r.color;
    $('regionDescription').textContent = r.description;
    $('regionBonus').textContent = r.bonus;
    document
      .querySelectorAll('[data-region]')
      .forEach((b) => b.classList.toggle('selected', b.dataset.region === id));
  }
  show(scene) {
    if (this.game && this.current === 'game' && scene !== 'game') this.game.suspend();
    this.current = scene;
    for (const name of ['title', 'main', 'game'])
      $(name === 'main' ? 'mainScene' : name === 'title' ? 'titleScene' : 'gameScene').hidden =
        name !== scene;
    this.tooltip.hide();
    const saved = this.saves.load();
    $('titleResume').hidden = !saved || saved.ended;
    $('mainResume').hidden = !saved || saved.ended;
    requestAnimationFrame(() => this.draw());
  }
  draw() {
    if (this.current === 'title') this.atlas.draw($('titleAtlas'));
    if (this.current === 'main') this.atlas.draw($('worldAtlas'));
  }
  launch(resume) {
    const saved = this.saves.load();
    if (
      !resume &&
      saved &&
      !saved.ended &&
      !confirm('새 출정을 시작하면 현재 저장된 작전을 대체합니다. 시작할까요?')
    )
      return;
    this.show('game');
    if (!this.game) this.game = createGame(() => this.show('main'));
    if (resume && saved) {
      this.game.resume(saved);
    } else this.game.newCampaign(this.selected);
  }
  openCodex() {
    if (!$('codexCards').children.length)
      $('codexCards').innerHTML = Object.entries(DEFINITIONS)
        .map(
          ([type, d]) =>
            `<button class="codex-card" data-type="${type}"><img src="${modelPreview(type)}" alt="${d.name}"><strong>${d.name}</strong><small>${d.building ? '건물' : '유닛'} · 체력 ${d.hp}</small></button>`,
        )
        .join('');
    $('codexModal').hidden = false;
  }
}
try {
  const manager=new SceneManager();
  window.ironmarchCollection={leave:()=>{if(manager.game)manager.game.suspend();}};
} catch (error) {
  console.error(error);
  $('fatal').hidden = false;
  $('fatal').textContent = '화면을 준비하지 못했습니다. 새로고침해 주세요. ' + error.message;
  document.body.append($('fatal'));
}
