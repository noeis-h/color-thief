import './style.css';
import { loadAssets } from './assets';
import { FX } from './fx';
import { Game, type GameEvent } from './game';
import { iso } from './iso';
import { LEVELS } from './levels';
import { cam, draw, fitCamera, HEX, initRenderer, pick, playerChest, setHover } from './render';
import { persist, save, starsFor } from './save';
import { closeModal, guideStep, initUI, modalOpen, openHelp, openHints, openLevels, showEnding, showResult, updateHintButton } from './ui';

const $ = (id: string) => document.getElementById(id)!;
const canvas = $('view') as HTMLCanvasElement;
const fx = new FX();
let game: Game;
let time = 0;

function startingLevel() {
  const q = new URLSearchParams(location.search).get('level');
  if (q) return Math.max(0, Math.min(LEVELS.length - 1, Number(q) - 1));
  return Math.min(save.current, save.unlocked, LEVELS.length - 1);
}

function objPoint(o: { x: number; y: number; z: number; kind: string }) {
  return iso(o.x + 0.5, o.y + 0.5, (o.kind === 'crystal' ? o.z : 0) + 0.6);
}

function onEvent(e: GameEvent) {
  switch (e.type) {
    case 'extract': {
      const from = objPoint(e.obj);
      fx.stream(from, playerChest(game), HEX[e.color]);
      fx.burst(from, HEX[e.color], 18, 90, 3);
      fx.ring(from, HEX[e.color], 60);
      break;
    }
    case 'inject': {
      const to = objPoint(e.obj);
      fx.stream(playerChest(game), to, HEX[e.color]);
      setTimeout(() => {
        fx.ring(to, HEX[e.color], 110, 0.8);
        fx.burst(to, HEX[e.color], e.obj.kind === 'crate' ? 60 : 26, e.obj.kind === 'crate' ? 220 : 120, e.obj.kind === 'crate' ? 5 : 3);
        if (e.obj.kind === 'crate') { fx.burst(to, '#ffb070', 30, 160, 3); fx.shake = 6; }
      }, 420);
      break;
    }
    case 'bump': {
      const el = $('carry');
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      break;
    }
    case 'door': {
      const d = game.objs.find(o => o.kind === 'door');
      if (d && e.open) setTimeout(() => {
        const p = iso(d.x + 0.5, d.y + 1, 1);
        fx.burst(p, HEX.yellow, 40, 160, 3);
        fx.ring(iso(d.x + 0.5, d.y + 1.2, 0), HEX.yellow, 120, 1);
      }, 500);
      break;
    }
    case 'win': {
      const i = game.index;
      const stars = starsFor(i);
      const best = Math.max(save.best[i], stars);
      save.best[i] = best;
      save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
      save.hints[i] = 0;
      save.board = null;
      save.current = Math.min(i + 1, LEVELS.length - 1);
      persist();
      setTimeout(() => showResult(i, stars, best), 800);
      break;
    }
  }
}

let cardTimer = 0;
function startLevel(i: number, resume = false) {
  if (i >= LEVELS.length) { showEnd(); return; }
  ended = false;
  setHover(null);
  game = new Game(LEVELS[i], i, onEvent);
  if (resume && save.board?.level === i) game.importState(save.board.state);
  else save.board = null;
  save.current = i;
  persist();
  lastBoard = JSON.stringify(save.board?.state ?? null);
  updateHintButton();
  fx.parts = []; fx.streams = []; fx.rings = [];
  fitCamera(game);
  $('lvl').textContent = `스테이지 ${i + 1}`;
  $('cardLvl').textContent = `스테이지 ${i + 1} / ${LEVELS.length}`;
  $('cardName').textContent = LEVELS[i].name;
  $('cardHint').textContent = LEVELS[i].hint;
  $('card').classList.add('on');
  clearTimeout(cardTimer);
  cardTimer = window.setTimeout(() => $('card').classList.remove('on'), 1800);
  $('fade').classList.remove('on');
}

/** Keeps the mid-level board in the save so a reload resumes where the player stood. */
let lastBoard = '';
function autosave() {
  if (game.busy || ended) return;
  const state = game.exportState();
  const json = JSON.stringify(state);
  if (json === lastBoard) return;
  lastBoard = json;
  save.board = { level: game.index, state };
  persist();
}

function showEnd() {
  game.won = true;
  ended = true;
  $('fade').classList.remove('on');
  showEnding();
}
let ended = false;

const COLOR_NAME = { red: '빨강', blue: '파랑', yellow: '노랑' };

let lastCarry: string | null | undefined;
function updateHud() {
  if (game.carry === lastCarry) return;
  lastCarry = game.carry;
  $('carryTxt').textContent = game.carry ? COLOR_NAME[game.carry] : '없음';
  const gem = $('carryGem');
  const col = game.carry ? HEX[game.carry] : '#6d7280';
  gem.style.setProperty('--c', col);
  gem.style.boxShadow = game.carry ? `0 0 14px ${col}88, inset 0 0 8px ${col}66` : 'none';
}

function restart() {
  startLevel(ended ? 0 : game.index);
}

window.addEventListener('keydown', e => {
  const m = modalOpen();
  if (m) {
    if (e.code === 'Escape' && m.id !== 'result') closeModal();
    else if (m.id === 'help' && (e.code === 'ArrowRight' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); guideStep(1); }
    else if (m.id === 'help' && e.code === 'ArrowLeft') guideStep(-1);
    else if (m.id === 'result' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); $('resultNext').click(); }
    else if (m.id === 'ending' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); $('endingReplay').click(); }
    return;
  }
  if (e.key === '?' || e.code === 'F1') { e.preventDefault(); openHelp(); return; }
  if (e.code === 'KeyH') { openHints(); return; }
  if (e.code === 'KeyL') { openLevels(); return; }
  if (e.code === 'KeyR') { restart(); return; }
  if (ended) return;
  // movement is mouse-only; SPACE is the only way to steal or give a color
  if (e.code === 'Space') { e.preventDefault(); game.interact(); }
  else if (e.code === 'KeyZ') game.undo();
});

// Clicking moves: a tile walks there, an object walks next to it and turns to face it.
canvas.addEventListener('pointerdown', e => {
  if (ended || game.won || modalOpen()) return;
  const hit = pick(game, e.clientX, e.clientY);
  if (!hit) return;
  if (hit.obj) game.goTo(hit.obj.x, hit.obj.y, hit.obj);
  else game.goTo(hit.x, hit.y);
});

canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const hit = ended || modalOpen() ? null : pick(game, e.clientX, e.clientY);
  setHover(hit);
  canvas.style.cursor = hit && (hit.obj || game.walkable(hit.x, hit.y)) ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => setHover(null));

$('restart').addEventListener('click', restart);
$('undoBtn').addEventListener('click', () => { if (!ended) game.undo(); });

initUI({
  level: () => game.index,
  play: i => startLevel(i),
  next: () => {
    $('fade').classList.add('on');
    setTimeout(() => startLevel(game.index + 1), 500);
  },
  replay: () => startLevel(game.index),
  restartAll: () => startLevel(0),
});

function emitAmbient(dt: number) {
  for (const o of game.objs) {
    const c = o.color ?? (o.kind === 'water' && o.anim > 0.5 ? 'blue' : null);
    if (!c || o.kind === 'water' && o.anim < 0.5) continue;
    if (Math.random() < dt * (o.kind === 'fire' ? 9 : 3)) fx.mote(objPoint(o), HEX[c], 50);
  }
}

function tick(dt: number) {
  time += dt;
  game.update(dt);
  emitAmbient(dt);
  fx.update(dt);
  draw(game, fx, time);
  updateHud();
  autosave();
}

let last = performance.now();
function frame(now: number) {
  tick(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
}

(async () => {
  initRenderer(canvas);
  await loadAssets();
  startLevel(startingLevel(), true);
  requestAnimationFrame(frame);
  if (!save.seenHelp) setTimeout(() => openHelp(), 900);
  // dev hook: lets tests drive frames by hand (rAF pauses while the page is hidden)
  if (import.meta.env.DEV) Object.assign(window, { ct: { get game() { return game; }, pick, startLevel, cam, iso, step: (n: number) => { for (let i = 0; i < n; i++) tick(1 / 60); }, sim: (n: number) => { for (let i = 0; i < n; i++) game.update(1 / 60); } } });
})();
