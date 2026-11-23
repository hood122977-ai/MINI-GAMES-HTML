/** Classic RTS layout: map, selected forces, contextual commands. Reuses HUD controls. */
export function mountCommandConsole() {
  const $ = (id) => document.getElementById(id),
    game = $('gameScene');
  const dock = document.createElement('footer');
  dock.id = 'rtsConsole';
  dock.innerHTML =
    '<section class="radar-console"></section><section class="forces-console"><div class="forces-top"></div><div class="forces-body"><div class="portrait-console"></div><div class="roster-console"></div></div><div class="groups-console"></div></section><section class="actions-console"><div class="console-tabs"><button id="commandTab" class="active">명령</button></div><div class="action-content"></div></section>';
  game.append(dock);
  const put = (sel, node) => dock.querySelector(sel).append(node);
  put('.radar-console', game.querySelector('.minimap-wrap'));
  put('.radar-console', $('focusSelection'));
  put('.radar-console', $('home'));
  put('.forces-top', $('typeFilters'));
  put('.forces-top', $('clearSelection'));
  put('.portrait-console', game.querySelector('.unit-heading'));
  put('.portrait-console', $('selectionCount'));
  put('.portrait-console', $('health'));
  put('.roster-console', $('unitRoster'));
  put('.groups-console', $('squadSlots'));
  put('.groups-console', game.querySelector('.squad-assign'));
  put('.console-tabs', $('buildTab'));
  put('.console-tabs', $('armyTab'));
  put('.action-content', game.querySelector('.orders'));
  put('.action-content', game.querySelector('.formation-panel'));
  put('.action-content', $('cards'));
  put('.actions-console', $('contextHelp'));
  put('.actions-console', $('queue'));
  put('.actions-console', $('panelHint'));
  game.querySelector('aside').hidden = true;
  game.querySelector('.command-dock').hidden = true;
  game.querySelector('.map-bottom').innerHTML =
    '<span>휠 버튼 드래그 / 화면 끝: 카메라 이동 · 휠: 확대 · 우클릭: 명령</span>';
}
