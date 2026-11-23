import { SquadPanel } from './squad-panel.js';
import { modelPreview, statHTML } from './previews.js';
import { MAP } from './geography.js';
import { DEFINITIONS as D } from './core.js';
import { TrainCommand } from './systems.js';
const $ = (id) => document.getElementById(id);
const time = (t) =>
  String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
export class HUD {
  constructor(world, input, renderer, territory, commands, bus, session) {
    Object.assign(this, { world, input, renderer, territory, commands, bus, session });
    this.tab = 'orders';
    this.timer = 0;
    this.miniTimer = 0;
    this.toastTimer = 0;
    this.renderCards();
    $('commandTab').onclick = () => this.changeTab('orders');
    $('buildTab').onclick = () => this.changeTab('build');
    $('armyTab').onclick = () => this.changeTab('army');
    $('cards').onclick = (e) => {
      let b = e.target.closest('[data-type]');
      if (b) this.activate(b.dataset.type);
    };
    $('all').onclick = () => input.all();
    $('typeFilters').innerHTML = ['all', 'sword', 'bow', 'ram']
      .map(
        (t) =>
          `<button data-filter="${t}">${t === 'all' ? '전체 병력' : `<img src="${modelPreview(t)}" alt="">${D[t].name}`}<b>0</b></button>`,
      )
      .join('');
    $('typeFilters').onclick = (e) => {
      const b = e.target.closest('[data-filter]');
      if (b) input.selectType(b.dataset.filter, e.shiftKey);
    };
    $('focusSelection').onclick = () => input.focusSelection();
    $('clearSelection').onclick = () => {
      input.selection.clear();
      bus.emit('selection');
    };
    $('moveOrder').onclick = () => input.setMode('move');
    $('unitRoster').onclick = (e) => {
      const b = e.target.closest('[data-unit]');
      if (b) input.selectUnit(Number(b.dataset.unit), e.shiftKey);
    };
    $('unitRoster').ondblclick = () => input.focusSelection();

    $('attack').onclick = () => {
      if (world.units(0).some((u) => input.selection.has(u.id))) input.setMode('attack');
      else this.toast('아군 부대를 먼저 선택하세요.');
    };
    $('stop').onclick = () => input.stop();
    $('hold').onclick = () => input.hold();
    $('menuReturn').onclick = () => session.leave();
    document
      .querySelectorAll('[data-formation]')
      .forEach((b) => (b.onclick = () => input.setFormation(b.dataset.formation)));
    bus.on('formation', (kind) =>
      document
        .querySelectorAll('[data-formation]')
        .forEach((b) => b.classList.toggle('active', b.dataset.formation === kind)),
    );
    this.squadPanel = new SquadPanel(world, input, bus, session);
    $('home').onclick = () => renderer.home();
    $('zoomIn').onclick = () => renderer.zoom(-1);
    $('zoomOut').onclick = () => renderer.zoom(1);
    $('pause').onclick = () => session.toggle();
    $('start').onclick = () => session.start();
    $('reset').onclick = () => {
      if (confirm('저장된 진행을 지우고 새 작전을 시작할까요?')) session.reset();
    };
    $('replay').onclick = () => session.reset();
    $('help').onclick = () => {
      this.resumeAfterHelp = session.started && !session.paused;
      session.paused = true;
      $('helpModal').hidden = false;
    };
    const close = () => {
      $('helpModal').hidden = true;
      if (this.resumeAfterHelp) session.paused = false;
    };
    $('closeHelp').onclick = close;
    $('continue').onclick = close;
    $('mini').onclick = (e) => {
      let r = $('mini').getBoundingClientRect();
      renderer.focus.set(
        ((e.clientX - r.left) / r.width) * MAP.w,
        0,
        ((e.clientY - r.top) / r.height) * MAP.h,
      );
      renderer.updateCamera();
    };
    bus.on('notice', (m) => this.toast(m));
    bus.on('wave', (n) => this.toast(`경보 · ${n}차 적 공세가 시작됐습니다!`));
    bus.on('capture', (p) =>
      this.toast(`${p.owner === 0 ? '아군' : '적'}이 ${p.name}을 점령했습니다.`),
    );
    bus.on('built', (e) => this.toast(`${D[e.type].name} 건설 완료`));
    bus.on('selection', () => {
      let e = this.selected()[0];
      if (e?.type === 'barracks' && e.team === 0) this.changeTab('army');
      if (e?.team === 0 && D[e.type].building && e.type !== 'barracks' && e.type !== 'wall') this.changeTab('build');
      else if (e && e.type !== 'barracks') this.changeTab('orders');
      this.update(0.2);
    });
    bus.on('mode', ({ mode, type }) => {
      this.refreshCardState();
      $('modeHint').hidden = mode === 'select';
      $('modeHint').textContent =
        mode === 'build'
          ? `${D[type].name} 배치 · ${type === 'wall' ? '드래그로 연속 건설' : '땅을 클릭하세요'} · Esc 취소`
          : mode === 'move'
            ? '이동 · 목적지를 클릭하세요 · Esc 취소'
            : '공격 이동 · 목표 지점을 클릭하세요';
      $('attack').classList.toggle('active', mode === 'attack');
    });
    bus.on('hotkey', (n) => {
      const t = this.cardTypes()[n];
      if (t) this.activate(t);
    });
    bus.on('end', (e) => {
      session.paused = true;
      $('endModal').hidden = false;
      $('endTitle').textContent =
        e.winner === 0 ? '작전 성공. 전선 장악.' : '사령부가 함락되었습니다.';
      $('endInfo').textContent =
        `작전 시간 ${time(e.time)} · 적 공세 ${e.wave}회 · 점령 거점 ${world.points.filter((p) => p.owner === 0).length}/${world.points.length}`;
    });
    bus.on('reset', () => {
      $('endModal').hidden = true;
      this.changeTab('orders');
    });
  }
  selected() {
    return [...this.input.selection].map((id) => this.world.get(id)).filter(Boolean);
  }
  cardTypes() {
    if (this.tab === 'orders') return [];
    return this.tab === 'build'
      ? ['mine', 'barracks', 'wall', 'tower', 'outpost']
      : ['sword', 'bow', 'ram'];
  }
  changeTab(tab) {
    this.input.cancel();
    this.tab = tab;
    $('commandTab').classList.toggle('active', tab === 'orders');
    document.querySelector('.actions-console .orders').hidden = tab !== 'orders';
    document.querySelector('.actions-console .formation-panel').hidden = tab !== 'orders';
    $('panelHint').hidden = tab === 'orders';
    $('buildTab').classList.toggle('active', tab === 'build');
    $('armyTab').classList.toggle('active', tab === 'army');
    this.renderCards();
  }
  renderCards() {
    $('cards').innerHTML = this.cardTypes()
      .map(
        (t, i) =>
          `<button class="card" data-type="${t}"><img class="model-thumb" src="${modelPreview(t)}" alt="${D[t].name} 모델"><span><strong>${D[t].name}${D[t].time ? ' · ' + D[t].time + '초' : ''}</strong><small>${D[t].desc}</small><div class="cost">◈ ${D[t].g}<span>▰ ${D[t].w}</span></div></span></button>`,
      )
      .join('');
    $('panelHint').textContent =
      this.tab === 'build'
        ? '건물 클릭 → 땅에 배치. 방벽: 아군 유닛 320 이내에서 자유롭게 드래그.'
        : '군사 기지를 선택하고 훈련할 부대를 추가하세요. (최대 대기 8기)';
    this.refreshCardState();
  }
  refreshCardState() {
    for (const b of $('cards').children) {
      const own = this.selected().filter((e) => e.team === 0);
      b.disabled =
        !this.world.canAfford(D[b.dataset.type]) ||
        (this.tab === 'army'
          ? !own.some((e) => e.type === 'barracks')
          : !own.some((e) => e.type !== 'wall'));
      b.classList.toggle('chosen', this.input.buildType === b.dataset.type);
      b.classList.toggle('unaffordable', !this.world.canAfford(D[b.dataset.type]));
    }
  }
  activate(type) {
    if (!this.session.started) {
      this.toast('먼저 작전을 시작하세요.');
      return;
    }
    if (this.session.paused) {
      this.toast('일시정지를 해제하세요.');
      return;
    }
    if (this.tab === 'build')
      this.input.setMode(
        this.input.buildType === type ? 'select' : 'build',
        this.input.buildType === type ? null : type,
      );
    else {
      let b = this.selected().find((e) => e.type === 'barracks' && e.team === 0);
      this.commands.dispatch(new TrainCommand(b?.id, type));
    }
  }
  toast(m) {
    $('toast').textContent = m;
    $('toast').classList.add('show');
    this.toastTimer = 3.2;
  }
  update(dt) {
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) $('toast').classList.remove('show');
    this.timer += dt;
    this.miniTimer += dt;
    if (this.miniTimer > 0.5) {
      this.miniTimer = 0;
      this.renderer.drawMinimap($('mini'));
    }
    if (this.timer < 0.15) return;
    this.timer = 0;
    for (const b of $('squadSlots').children) {
      const n = this.input.squads.members(Number(b.dataset.squad)).length;
      b.querySelector('small').textContent = n ? `${n}개 대상` : '미지정';
      b.classList.toggle('occupied', n > 0);
    }
    const w = this.world;
    const units = w.units(0);
    for (const b of $('typeFilters').children) {
      const ids = this.input.selector.units(b.dataset.filter).map((e) => e.id);
      b.querySelector('b').textContent = ids.length;
      b.disabled = !ids.length;
      b.classList.toggle(
        'active',
        ids.length > 0 &&
          ids.length === this.input.selection.size &&
          ids.every((id) => this.input.selection.has(id)),
      );
    }
    const rosterUnits = this.squadPanel.visibleUnits();
    this.squadPanel.refresh();
    const rosterKey = this.squadPanel.view + ':' + rosterUnits
      .map((e) => `${e.id}:${Math.ceil(e.hp)}:${this.input.selection.has(e.id)}`)
      .join('|');
    if (rosterKey !== this.rosterKey) {
      this.rosterKey = rosterKey;
      $('unitRoster').innerHTML = rosterUnits
        .map(
          (e) =>
            `<button data-unit="${e.id}" class="${this.input.selection.has(e.id) ? 'active' : ''}"><img src="${modelPreview(e.type)}" alt=""><span>${D[e.type].name} #${e.id}<small>체력 ${Math.ceil(e.hp)} / ${e.maxhp}</small></span></button>`,
        )
        .join('') || '<p class=empty-squad>이 분대는 비어 있습니다.<br>유닛 추가를 눌러 병력을 넣으세요.</p>';
    }
    const controllable = this.selected().filter((e) => e.team === 0 && !D[e.type].building);
    for (const id of ['moveOrder', 'attack', 'stop', 'hold', 'focusSelection'])
      $(id).disabled =
        id === 'assignSquad' ? !this.selected().some((e) => e.team === 0) : !controllable.length;
    $('armyTab').hidden = !this.selected().some((e) => e.team === 0 && e.type === 'barracks');
    $('buildTab').hidden = !this.selected().some(
      (e) => e.team === 0 && (e.type !== 'wall'),
    );
    $('commandTab').textContent = this.selected().some((e) => D[e.type].building) ? '정보' : '명령';
    $('contextHelp').textContent = controllable.length
      ? `${controllable.length}기만 명령을 받습니다. 이동 버튼을 누르고 땅을 클릭하거나, 바로 우클릭하세요.`
      : '위의 병종 버튼이나 개별 병력 목록에서 조종할 병력을 골라주세요.';

    let mines = w.buildings(0).filter((e) => e.type === 'mine').length,
      points = w.points.filter((p) => p.owner === 0).length;
    $('gold').textContent = Math.floor(w.gold).toLocaleString();
    $('wood').textContent = Math.floor(w.wood).toLocaleString();
    $('goldRate').textContent = `+${2 + mines * 8 + points * 5}/s`;
    $('woodRate').textContent = `+${1 + mines * 5 + points * 3}/s`;
    $('pop').innerHTML = `${w.units(0).length} <small>/ 80</small>`;
    $('clock').textContent = time(w.time);
    $('wave').textContent = time(Math.max(0, Math.ceil(w.nextWave - w.time)));
    $('waveTitle').textContent = `${w.wave + 1}차 적 공세`;
    $('territory').textContent = this.territory.shares[0] + '%';
    $('enemyTerritory').textContent = '적 ' + this.territory.shares[1] + '%';
    $('blueShare').style.width = this.territory.shares[0] + '%';
    $('redShare').style.width = this.territory.shares[1] + '%';
    $('pointList').innerHTML = w.points
      .map(
        (p) =>
          `<span style="border-color:${p.owner < 0 ? '#80704c' : p.owner ? '#d77d68' : '#55acdf'}">${p.name.split(' ')[0]} ${p.owner < 0 ? '◇' : p.owner ? '◆' : '⚑'}</span>`,
      )
      .join('');
    let es = this.selected(),
      e = es[0];
    $('selectionCount').textContent = es.length ? es.length + ' 선택' : '—';
    $('selName').textContent =
      es.length > 1 ? `부대 ${es.length}기` : e ? D[e.type].name : '부대를 선택하세요';
    $('selTag').textContent = e
      ? es.length > 1
        ? 'TASK FORCE'
        : D[e.type].tag
      : 'COMMAND YOUR FORCES';
    $('selectionIcon').innerHTML = e
      ? `<img src="${modelPreview(e.type)}" alt="${D[e.type].name}">`
      : '⌖';
    $('selInfo').textContent =
      es.length > 1
        ? '우클릭 이동 · 적 우클릭 집중 공격 · F 공격 이동'
        : e
          ? `${e.team ? '붉은 군단' : '청색 연합'} · ${D[e.type].desc || '본진을 지켜야 작전을 계속할 수 있습니다.'}`
          : '클릭으로 개별 선택, 드래그로 여러 유닛을 선택할 수 있습니다.';
    $('health').hidden = !e || es.length > 1;
    if (e) {
      $('healthText').textContent = `${Math.ceil(e.hp)} / ${e.maxhp}`;
      $('healthFill').style.width = (e.hp / e.maxhp) * 100 + '%';
    }
    let b = es.find((e) => e.team === 0 && e.type === 'barracks');
    $('queue').innerHTML = b
      ? b.queue.length
        ? `훈련 중: ${D[b.queue[0]].name} · ${Math.max(0, Math.ceil(D[b.queue[0]].time - b.progress))}초<div class="queue-chips">${b.queue.map((t) => `<span>${D[t].name}</span>`).join('')}</div>`
        : '훈련 대기 중 · 아래 유닛 카드를 선택하세요.'
      : '';
    $('pause').innerHTML = this.session.paused
      ? '▶ <span>계속하기</span>'
      : 'Ⅱ <span>일시정지</span>';
    $('pauseBadge').hidden =
      !this.session.started || !this.session.paused || w.ended || !$('helpModal').hidden;
    $('startBanner').hidden = this.session.started;
    if (e) {
      $('selectionIcon').innerHTML = `<img src="${modelPreview(e.type)}" alt="${D[e.type].name}">`;
      $('selectionIcon').dataset.type = e.type;
    } else {
      delete $('selectionIcon').dataset.type;
    }
    if (e && D[e.type].building) {
      $('contextHelp').textContent = e.team
        ? '적 건물 · 공격할 아군을 선택하세요.'
        : e.type === 'barracks'
          ? '유닛 생산 / 기지 건설 탭을 선택하세요. 땅 우클릭: 집결 지점'
          : e.type === 'hq'
            ? '건물 카드 선택 후 땅에 배치하세요.'
            : D[e.type].desc;
      document.querySelector('.actions-console .orders').hidden = true;
      document.querySelector('.actions-console .formation-panel').hidden = true;
    }
    this.refreshCardState();
  }
}
