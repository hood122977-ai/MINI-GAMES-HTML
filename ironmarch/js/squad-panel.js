import { DEFINITIONS as D } from './core.js';
import { modelPreview } from './previews.js';
const $ = id => document.getElementById(id);

/** Squad browsing and editing UI; membership is owned by SquadService. */
export class SquadPanel {
  constructor(world, input, bus, session) {
    Object.assign(this, { world, input, bus, session });
    this.view = null;
    $('squadSlots').innerHTML = Array.from({length:9}, (_,i) =>
      `<button data-squad="${i+1}" title="${i+1}분대 열기 · 카드를 여기로 드래그"><b>${i+1}분대</b><small>0기</small></button>`).join('');
    $('squadSlots').onclick = e => {
      const b = e.target.closest('[data-squad]');
      if (b) input.recall(Number(b.dataset.squad));
    };
    const all = document.createElement('button');
    all.id = 'allSquads'; all.textContent = '전체';
    all.onclick = () => { input.all(); input.focusSelection(); };
    document.querySelector('.groups-console').prepend(all);
    document.querySelector('.squad-assign').hidden = true;
    const toolbar = document.createElement('div');
    toolbar.className = 'squad-toolbar';
    toolbar.innerHTML = '<strong id="squadViewTitle">전체 병력</strong><span id="squadViewHelp"></span><button id="addSquadUnits">＋ 유닛 추가</button><button id="removeSquadUnits">선택 유닛 빼기</button>';
    document.querySelector('.forces-top').before(toolbar);
    $('addSquadUnits').onclick = () => this.openPicker();
    $('removeSquadUnits').onclick = () => {
      input.squads.remove(this.view, [...input.selection]);
      input.recall(this.view);
    };
    bus.on('squadView', number => { this.view = number; this.refresh(); });
    bus.on('reset', () => { this.view = null; this.refresh(); });
    bus.on('squads', () => this.refresh());
    const roster = $('unitRoster');
    roster.ondragstart = e => e.preventDefault();
    roster.addEventListener('pointerdown', e => {
      const card = e.target.closest('[data-unit]');
      if (e.button !== 0 || !card) return;
      this.drag = { id:Number(card.dataset.unit), x:e.clientX, y:e.clientY, moved:false };
    });
    document.addEventListener('pointermove', e => {
      if (!this.drag) return;
      if (Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>6) this.drag.moved=true;
      if (!this.drag.moved) return;
      document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
      document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-squad]')?.classList.add('drop-target');
    });
    document.addEventListener('pointerup', e => {
      if (!this.drag) return;
      const drag=this.drag; this.drag=null;
      document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
      if (!drag.moved) return;
      const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-squad]');
      if (b) input.squads.transfer(Number(b.dataset.squad),[drag.id]);
      this.refresh();
    });
    document.addEventListener('pointercancel', () => {
      this.drag=null;
      document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
    });
    this.dialog=document.createElement('dialog');
    this.dialog.id='squadPicker';
    this.dialog.setAttribute('aria-labelledby','squadPickerTitle');
    document.body.append(this.dialog);
    this.dialog.addEventListener('close',()=>{session.paused=this.wasPaused;});
    this.refresh();
  }
  visibleUnits() {
    const ids=this.view===null ? null : this.input.squads.members(this.view);
    return this.world.units(0).filter(e=>!ids || ids.includes(e.id));
  }
  refresh() {
    $('allSquads').classList.toggle('active',this.view===null);
    $('squadViewTitle').textContent=this.view===null?'전체 병력':`${this.view}분대 · ${this.visibleUnits().length}기`;
    $('squadViewHelp').textContent='카드를 분대 버튼으로 드래그해 이동';
    $('addSquadUnits').hidden=this.view===null;
    $('removeSquadUnits').hidden=this.view===null;
    $('removeSquadUnits').disabled=!this.visibleUnits().some(e=>this.input.selection.has(e.id));
    for(const b of $('squadSlots').children){
      const n=Number(b.dataset.squad);
      b.classList.toggle('active',n===this.view);
      b.querySelector('small').textContent=`${this.input.squads.members(n).length}기`;
    }
  }
  openPicker() {
    if(this.view===null) return;
    this.wasPaused=this.session.paused;
    this.session.paused=true;
    this.input.keys={};
    const target=this.view, current=this.input.squads.members(target);
    const available=this.world.units(0).filter(e=>!current.includes(e.id));
    this.dialog.innerHTML=`<h2 id="squadPickerTitle">${target}분대에 유닛 추가</h2><p>추가할 병력을 선택하세요. 다른 분대 소속이면 이 분대로 이동합니다.</p><div class="squad-pick-list">${available.map(e=>{
      const n=Array.from({length:9},(_,i)=>i+1).find(n=>this.input.squads.members(n).includes(e.id));
      return `<label><input type="checkbox" value="${e.id}"><img src="${modelPreview(e.type)}" alt=""><span>${D[e.type].name} #${e.id}<small>${n?n+'분대':'미편성'} · 체력 ${Math.ceil(e.hp)}</small></span></label>`;
    }).join('')||'<p>추가할 유닛이 없습니다.</p>'}</div><footer><button id="cancelSquadPick">취소</button><button id="confirmSquadPick" disabled>선택한 유닛 추가 (0)</button></footer>`;
    this.dialog.onchange=()=>{
      const count=this.dialog.querySelectorAll('input:checked').length;
      $('confirmSquadPick').disabled=count===0;
      $('confirmSquadPick').textContent=`선택한 유닛 추가 (${count})`;
    };
    $('cancelSquadPick').onclick=()=>this.dialog.close();
    $('confirmSquadPick').onclick=()=>{
      this.input.squads.transfer(target,[...this.dialog.querySelectorAll('input:checked')].map(e=>Number(e.value)));
      this.dialog.close(); this.input.recall(target);
    };
    this.dialog.showModal();
  }
}
