export class SelectionService {
  constructor(world) {
    this.world = world;
  }
  units(type = 'all') {
    return this.world.units(0).filter((e) => type === 'all' || e.type === type);
  }
  choose(type, current = [], additive = false) {
    return new Set([...(additive ? current : []), ...this.units(type).map((e) => e.id)]);
  }
}
