import { DEFINITIONS as D } from './core.js';
/** Formation strategy and control-group service, independent of rendering. */
export const FORMATIONS = { box: '방진', line: '횡대', column: '종대', wedge: '쐐기' };
export function formationSlots(count, kind = 'box', spacing = 52) {
  let result = [];
  for (let i = 0; i < count; i++) {
    let x = 0,
      y = 0;
    if (kind === 'line') {
      let width = Math.min(10, count);
      x = ((i % width) - (width - 1) / 2) * spacing;
      y = Math.floor(i / width) * spacing;
    } else if (kind === 'column') {
      let width = Math.min(2, count);
      x = ((i % width) - (width - 1) / 2) * spacing;
      y = Math.floor(i / width) * spacing;
    } else if (kind === 'wedge') {
      let row = Math.ceil(i / 2);
      x = i === 0 ? 0 : (i % 2 ? -1 : 1) * row * spacing * 0.65;
      y = row * spacing * 0.75;
    } else {
      let width = Math.ceil(Math.sqrt(count));
      x = ((i % width) - (width - 1) / 2) * spacing;
      y = Math.floor(i / width) * spacing;
    }
    result.push({ x, y });
  }
  if (result.length) {
    let cy = result.reduce((s, p) => s + p.y, 0) / count;
    result.forEach((p) => (p.y -= cy));
  }
  return result;
}
export class SquadService {
  constructor(world, bus) {
    this.world = world;
    this.bus = bus;
  }
  members(number) {
    return (this.world.squads[number] || []).filter((id) => {
      let e = this.world.get(id);
      return e && e.team === 0;
    });
  }
  transfer(number, ids) {
    if (!Number.isInteger(number) || number < 1 || number > 9) return false;
    const valid = [...new Set(ids)].filter(id => {
      const e = this.world.get(id);
      return e && e.hp > 0 && e.team === 0 && !D[e.type].building;
    });
    if (!valid.length) return false;
    for (let n = 1; n <= 9; n++)
      this.world.squads[n] = this.members(n).filter(id => !valid.includes(id));
    this.world.squads[number] = [...new Set([...this.members(number), ...valid])];
    this.bus.emit('squads');
    this.bus.emit('notice', `${number}분대에 ${valid.length}기 추가`);
    return true;
  }
  remove(number, ids) {
    this.world.squads[number] = this.members(number).filter(id => !ids.includes(id));
    this.bus.emit('squads');
  }
  assign(number, ids) {
    const valid = [...ids].filter((id) => {
      let e = this.world.get(id);
      return e && e.team === 0;
    });
    if (!valid.length) {
      this.bus.emit('notice', '등록할 아군 유닛이나 건물을 선택하세요.');
      return false;
    }
    this.world.squads[number] = [...new Set(valid)];
    this.bus.emit('notice', `${number}분대 · ${valid.length}개 대상 등록`);
    this.bus.emit('squads');
    return true;
  }
}
