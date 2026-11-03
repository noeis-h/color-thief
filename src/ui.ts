import { assetSrc } from './assets';
import { LEVELS } from './levels';
import { persist, resetSave, save, starsFor } from './save';

// Overlay screens: how-to-play guide, hints, level select and the level-clear result.

const $ = (id: string) => document.getElementById(id)!;

interface Deps {
  level(): number;
  play(i: number): void;
  next(): void;
  replay(): void;
  restartAll(): void;
}

let deps: Deps;
let open: HTMLElement | null = null;

const STAR_PATH = 'M12 2.2l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.3l-6.2 3.6 1.6-6.9L2.1 9.3l7-.7z';
export const starsHTML = (n: number, size = 18, total = 3) =>
  Array.from({ length: total }, (_, i) => `<svg class="star${i < n ? ' on' : ''}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg>`).join('');

export const modalOpen = () => open;

function show(el: HTMLElement) {
  closeModal();
  open = el;
  el.classList.add('on');
}

export function closeModal() {
  if (open === $('help')) { save.seenHelp = true; persist(); }
  open?.classList.remove('on');
  open = null;
}

// ---- how to play ------------------------------------------------------------------------------

const ribbon = (color: string) =>
  `<svg class="ribbon" viewBox="0 0 120 48" style="--c:${color}"><path class="glow" d="M6 30 C 34 4, 62 46, 104 22"/><path d="M6 30 C 34 4, 62 46, 104 22"/><path class="head" d="M96 14 L108 21 L98 31"/></svg>`;
const img = (key: string, cls = '') => `<img class="art ${cls}" src="${assetSrc(key)}" alt="" draggable="false">`;
const gem = (c: string) => `<i class="gem" style="--c:${c}"></i>`;
const cursor = '<svg class="cursor" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.6L16 20l-3 1.4-3.4-7.3L4 18z"/></svg>';
const tile = `<svg class="tile-art" viewBox="0 0 120 70"><path d="M60 4 116 34 60 64 4 34z" fill="#e6e1d8" stroke="#ffd23d" stroke-width="3" stroke-dasharray="7 5"/><path d="M4 34v6l56 30 56-30v-6L60 64z" fill="#b9b2a6"/></svg>`;
// mirrors the HUD buttons so the guide shows exactly what to press
const ICON = {
  undo: '<svg width="22" height="22" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6L4 11l5 5"/><path d="M4.5 11H15a6.5 6.5 0 0 1 0 13h-3"/></svg>',
  restart: '<svg width="22" height="22" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M22.5 9.5A10 10 0 1 1 15 5"/><path d="M15 1.5v7M11.5 5h7"/></svg>',
  hint: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5.8 1.1.8 1.9V16h6v-.8c0-.8.3-1.4.9-1.9A6.5 6.5 0 0 0 12 2.5z"/></svg>',
};
const btnIcon = (k: keyof typeof ICON) => `<span class="key icon">${ICON[k]}</span>`;
const space = '<span class="key wide">SPACE</span>';
// SPACE keycap riding on the color ribbon between giver and receiver
const flow = (color: string) => `<div class="flow">${space}${ribbon(color)}</div>`;

function guidePages() {
  return [
    {
      title: '이동',
      art: `${img('player_none', 'sm')}${ribbon('#ebe7df')}<div class="click-art">${tile}${cursor}</div>`,
      text: '가고 싶은 바닥을 <b>클릭</b>하면 그곳까지 걸어갑니다.<br>수정이나 상자 같은 오브젝트를 클릭하면 <b>바로 옆 칸</b>까지 걸어갑니다.',
    },
    {
      title: '색 훔치기',
      art: `${img('crystal_red')}${flow('#ff4b3e')}${img('player_red')}`,
      text: '빛나는 오브젝트의 <b>상하좌우 옆 칸</b>에 서서 <b>SPACE</b>를 누르면 색을 훔칩니다.<br>바라보는 방향은 상관없고, 스카프가 들고 있는 색으로 물듭니다.',
    },
    {
      title: '색 주기',
      art: `${img('player_red')}${flow('#ff4b3e')}${img('decal_crate', 'face')}`,
      text: '그 색이 필요한 곳 옆에서 다시 <b>SPACE</b>를 누르면 색을 넘겨줍니다.<br>색은 <b>한 번에 하나</b>만 들 수 있습니다.',
    },
    {
      title: '색의 힘',
      art: `<div class="rules colors">
              <div class="rule">${gem('#ff4b3e')}${img('decal_crate', 'face xs')}<span class="to">→</span><span class="poof"></span><span class="lbl">봉인된 상자를 태웁니다</span></div>
              <div class="rule">${gem('#4aa8ff')}${img('tex_water', 'face xs')}<span class="to">→</span>${img('tex_ice', 'face xs')}<span class="lbl">물을 얼려 다리를 만듭니다</span></div>
              <div class="rule">${gem('#ffd23d')}${img('generator_off', 'xs')}<span class="to">→</span>${img('generator_on', 'xs')}<span class="lbl">발전기를 켜 문을 엽니다</span></div>
            </div>`,
      text: '화로, 등불, 얼음벽, 그리고 내가 만든 다리도 색을 품고 있습니다.<br>필요하면 언제든 다시 훔쳐 오세요.',
    },
    {
      title: '막혔을 때',
      art: `<div class="rules">
              <div class="rule">${btnIcon('undo')}<span class="lbl">한 걸음 되돌리기</span></div>
              <div class="rule">${btnIcon('restart')}<span class="lbl">스테이지 처음부터 다시</span></div>
              <div class="rule">${btnIcon('hint')}<span class="lbl">힌트 · 볼 때마다 별 하나 차감</span></div>
              <div class="rule stars-row">${starsHTML(3, 22)}<span class="lbl">힌트 없이 클리어하면 별 3개</span></div>
            </div>`,
      text: '힌트는 넌지시 알려주는 것부터 정답까지 세 단계입니다.<br>진행 상황은 자동으로 저장됩니다.',
    },
  ];
}

let page = 0;
let pages: ReturnType<typeof guidePages> = [];

function renderGuide() {
  const p = pages[page];
  $('guideTitle').textContent = p.title;
  $('guideArt').innerHTML = p.art;
  $('guideText').innerHTML = p.text;
  $('guideDots').innerHTML = pages.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('');
  $('guidePrev').toggleAttribute('disabled', page === 0);
  $('guideNext').textContent = page === pages.length - 1 ? '시작하기' : '다음';
}

export function openHelp(start = 0) {
  if (!pages.length) pages = guidePages();
  page = start;
  renderGuide();
  show($('help'));
}

export function guideStep(d: number) {
  if (page + d >= pages.length) { closeModal(); return; }
  page = Math.max(0, page + d);
  renderGuide();
}

// ---- hints ------------------------------------------------------------------------------------

const TIERS = ['넌지시', '단서', '정답'];

function renderHints() {
  const l = deps.level();
  const used = save.hints[l];
  $('hintsStars').innerHTML = starsHTML(starsFor(l), 22);
  $('hintsList').innerHTML = LEVELS[l].hints.map((h, t) => {
    const head = `<div class="tier"><span>${['I', 'II', 'III'][t]}</span>${TIERS[t]}</div>`;
    if (t < used) return `<div class="hint-item open">${head}<p>${h}</p></div>`;
    if (t === used) return `<div class="hint-item next">${head}<button class="btn" data-reveal>힌트 보기&nbsp;·&nbsp;−1 ${starsHTML(1, 13, 1)}</button></div>`;
    return `<div class="hint-item locked">${head}<p>힌트 ${['I', 'II'][t - 1]}를 먼저 확인하세요</p></div>`;
  }).join('');
}

export function openHints() {
  renderHints();
  show($('hints'));
}

function revealHint() {
  const l = deps.level();
  if (save.hints[l] >= 3) return;
  save.hints[l]++;
  persist();
  renderHints();
  updateHintButton();
}

export function updateHintButton() {
  $('hintStars').innerHTML = starsHTML(starsFor(deps.level()), 15);
}

// ---- level select -----------------------------------------------------------------------------

let resetArmed = false;

function renderLevels() {
  $('levelGrid').innerHTML = LEVELS.map((lv, i) => {
    const locked = i > save.unlocked;
    const best = save.best[i];
    return `<button class="level-card${locked ? ' locked' : ''}${i === deps.level() ? ' current' : ''}" data-level="${i}" ${locked ? 'disabled' : ''}>
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <span class="name">${locked ? '잠김' : lv.name}</span>
      <span class="stars">${best >= 0 ? starsHTML(best, 15) : locked ? '' : '<em>미클리어</em>'}</span>
    </button>`;
  }).join('');
  const total = save.best.reduce((a, b) => a + Math.max(0, b), 0);
  $('levelTotal').innerHTML = `${starsHTML(1, 15, 1)} ${total} / ${LEVELS.length * 3}`;
  resetArmed = false;
  $('resetProgress').textContent = '진행 초기화';
}

export function openLevels() {
  renderLevels();
  show($('levels'));
}

// ---- result -----------------------------------------------------------------------------------

export function showResult(level: number, stars: number, best: number) {
  $('resultLvl').textContent = `스테이지 ${level + 1} 클리어`;
  $('resultName').textContent = LEVELS[level].name;
  $('resultStars').innerHTML = starsHTML(stars, 46);
  const used = 3 - stars;
  $('resultNote').textContent = used === 0 ? '힌트 없이 클리어!' : `힌트 ${used}개 사용${best > stars ? ` · 최고 기록 별 ${best}개` : ''}`;
  $('resultNext').textContent = level === LEVELS.length - 1 ? '완료' : '다음 스테이지';
  show($('result'));
}

// ---- all stages cleared ---------------------------------------------------------------------

export function showEnding() {
  const total = save.best.reduce((a, b) => a + Math.max(0, b), 0);
  $('endingTotal').innerHTML = `${starsHTML(1, 18, 1)} ${total} / ${LEVELS.length * 3}`;
  show($('ending'));
}

// ---- wiring -----------------------------------------------------------------------------------

export function initUI(d: Deps) {
  deps = d;
  $('helpBtn').addEventListener('click', () => openHelp());
  $('levelsBtn').addEventListener('click', openLevels);
  $('hintBtn').addEventListener('click', openHints);
  $('guidePrev').addEventListener('click', () => guideStep(-1));
  $('guideNext').addEventListener('click', () => guideStep(1));
  $('resultNext').addEventListener('click', () => { closeModal(); deps.next(); });
  $('resultReplay').addEventListener('click', () => { closeModal(); deps.replay(); });
  $('endingReplay').addEventListener('click', () => { closeModal(); deps.restartAll(); });
  $('endingLevels').addEventListener('click', openLevels);
  $('hintsList').addEventListener('click', e => { if ((e.target as Element).closest('[data-reveal]')) revealHint(); });
  $('levelGrid').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-level]');
    if (b && !b.hasAttribute('disabled')) { closeModal(); deps.play(Number(b.dataset.level)); }
  });
  $('resetProgress').addEventListener('click', () => {
    if (!resetArmed) { resetArmed = true; $('resetProgress').textContent = '한 번 더 누르면 모든 기록이 지워집니다'; return; }
    resetSave();
    closeModal();
    deps.play(0);
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  document.querySelectorAll<HTMLElement>('.modal').forEach(m => m.addEventListener('pointerdown', e => {
    if (e.target === m && m.id !== 'result' && m.id !== 'ending') closeModal();
  }));
}
