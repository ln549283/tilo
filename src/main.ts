import './style.css';
import { CIRCLE, DIAMOND, EMPTY, cloneGrid, type FilledValue, type Grid, type Level, type Position } from './core/model';
import { generateLevel } from './core/generator';
import { findHint } from './core/solver';
import { gridIsValid } from './core/rules';
import { initializeAds, showRewardedHint } from './ads';

const STORAGE_LEVEL = 'tilo-current-level';
const STORAGE_TUTORIAL = 'tilo-tutorial-seen';

let levelNumber = Math.max(1, Number(localStorage.getItem(STORAGE_LEVEL) || 1));
let variant = Date.now() >>> 0;
let level: Level = generateLevel(levelNumber, variant);
let grid: Grid = cloneGrid(level.initial);
let selected: FilledValue = CIRCLE;
let errors = 0;
let hintsLeft = 3;
let bonusHints = 0;
let bonusOfferShown = false;
let hintPosition: Position | null = null;
let screen: 'home' | 'rules' | 'game' = 'home';

const app = document.querySelector<HTMLDivElement>('#app')!;
initializeAds();

function symbol(value: number) {
  if (value === CIRCLE) return '<span class="piece circle" aria-label="cercle"></span>';
  if (value === DIAMOND) return '<span class="piece diamond" aria-label="losange"></span>';
  return '';
}

function render() {
  if (screen === 'home') return renderHome();
  if (screen === 'rules') return renderRules();
  return renderGame();
}

function renderHome() {
  app.innerHTML = `
    <main class="screen home-screen">
      <button class="ghost-icon top-right" id="rulesBtn" aria-label="Règles">?</button>
      <div class="brand-lockup">
        <div class="brand-symbols"><span class="piece circle hero-piece"></span><span class="piece diamond hero-piece"></span></div>
        <h1>TILO</h1>
        <p>Deux symboles. Une logique.</p>
      </div>
      <div class="home-bottom">
        <div class="current-level">Niveau ${levelNumber}</div>
        <button class="primary" id="playBtn">Jouer</button>
        <small>Nibylo Games</small>
      </div>
    </main>`;

  document.querySelector('#playBtn')?.addEventListener('click', () => {
    screen = localStorage.getItem(STORAGE_TUTORIAL) ? 'game' : 'rules';
    render();
  });
  document.querySelector('#rulesBtn')?.addEventListener('click', () => { screen = 'rules'; render(); });
}

function renderRules() {
  app.innerHTML = `
    <main class="screen rules-screen">
      <button class="ghost-icon top-left" id="backBtn" aria-label="Retour">‹</button>
      <div class="rules-content">
        <span class="eyebrow">COMMENT JOUER</span>
        <h2>Simple à apprendre.</h2>
        <div class="rule"><b>1</b><div><strong>Équilibre chaque ligne.</strong><span>Autant de ${symbol(CIRCLE)} que de ${symbol(DIAMOND)}.</span></div></div>
        <div class="rule"><b>2</b><div><strong>Jamais trois identiques.</strong><span>Ni horizontalement, ni verticalement.</span></div></div>
        <div class="rule"><b>3</b><div><strong>Lis les liens.</strong><span><span class="legend-link same-link">=</span> même symbole · <span class="legend-link different-link">×</span> symboles différents.</span></div></div>
      </div>
      <button class="primary" id="startBtn">J’ai compris</button>
    </main>`;

  document.querySelector('#backBtn')?.addEventListener('click', () => { screen = 'home'; render(); });
  document.querySelector('#startBtn')?.addEventListener('click', () => {
    localStorage.setItem(STORAGE_TUTORIAL, '1');
    screen = 'game';
    render();
  });
}

function constraintMarkup() {
  return level.constraints.map((constraint, i) => {
    const [ar, ac] = constraint.a;
    const [br, bc] = constraint.b;
    const horizontal = ar === br;
    const left = horizontal ? ((Math.min(ac, bc) + 1) / level.size) * 100 : ((ac + .5) / level.size) * 100;
    const top = horizontal ? ((ar + .5) / level.size) * 100 : ((Math.min(ar, br) + 1) / level.size) * 100;
    const same = constraint.type === 'same';
    return `<span class="constraint ${horizontal ? 'horizontal' : 'vertical'} ${same ? 'same' : 'different'}" style="left:${left}%;top:${top}%" data-i="${i}" aria-label="${same ? 'même symbole' : 'symboles différents'}">${same ? '=' : '×'}</span>`;
  }).join('');
}

function renderGame() {
  const clueSet = new Set(level.initial.flatMap((row, r) => row.map((v, c) => v !== EMPTY ? `${r}:${c}` : '')));
  const cells = grid.flatMap((row, r) => row.map((value, c) => {
    const fixed = clueSet.has(`${r}:${c}`);
    const highlighted = hintPosition?.[0] === r && hintPosition?.[1] === c;
    return `<button class="cell ${fixed ? 'fixed' : ''} ${highlighted ? 'hinted' : ''}" data-r="${r}" data-c="${c}" ${fixed ? 'disabled' : ''}>${symbol(value)}</button>`;
  })).join('');

  app.innerHTML = `
    <main class="screen game-screen">
      <header class="game-header">
        <button class="ghost-icon" id="homeBtn" aria-label="Accueil">‹</button>
        <div><span>NIVEAU</span><strong>${levelNumber}</strong></div>
        <div class="mistakes" aria-label="Erreurs">${[0,1,2].map(i => `<i class="mistake-dot ${i < errors ? 'used' : ''}"></i>`).join('')}</div>
      </header>

      <section class="board-wrap">
        <div class="board" style="--size:${level.size}">${cells}${constraintMarkup()}</div>
      </section>

      <div class="selector" aria-label="Choisir un symbole">
        <button class="symbol-button ${selected === CIRCLE ? 'selected' : ''}" data-value="${CIRCLE}">${symbol(CIRCLE)}</button>
        <button class="symbol-button ${selected === DIAMOND ? 'selected' : ''}" data-value="${DIAMOND}">${symbol(DIAMOND)}</button>
        <button class="erase-button" id="eraseBtn" aria-label="Effacer">⌫</button>
      </div>

      <button class="hint-button" id="hintBtn"><span>💡</span><b>Indice</b><em>${hintsLeft + bonusHints}</em></button>
      <div id="toast" class="toast"></div>
    </main>`;

  document.querySelector('#homeBtn')?.addEventListener('click', () => { screen = 'home'; render(); });
  document.querySelectorAll<HTMLButtonElement>('.symbol-button').forEach(btn => btn.addEventListener('click', () => {
    selected = Number(btn.dataset.value) as FilledValue;
    renderGame();
  }));
  document.querySelector('#eraseBtn')?.addEventListener('click', () => {
    selected = EMPTY as unknown as FilledValue;
    document.querySelectorAll('.symbol-button').forEach(x => x.classList.remove('selected'));
    document.querySelector('#eraseBtn')?.classList.add('selected');
  });
  document.querySelectorAll<HTMLButtonElement>('.cell:not(.fixed)').forEach(btn => btn.addEventListener('click', () => playCell(btn)));
  document.querySelector('#hintBtn')?.addEventListener('click', useHint);
}

function playCell(button: HTMLButtonElement) {
  const r = Number(button.dataset.r);
  const c = Number(button.dataset.c);
  const value = selected as number;

  if (value === EMPTY) {
    grid[r]![c] = EMPTY;
    hintPosition = null;
    renderGame();
    return;
  }

  if (value !== level.solution[r]![c]) {
    errors++;
    navigator.vibrate?.([45, 30, 45]);
    button.classList.add('wrong');
    setTimeout(() => {
      if (errors >= 3) showThirdErrorModal();
      else renderGame();
    }, 280);
    return;
  }

  grid[r]![c] = value as FilledValue;
  hintPosition = null;
  navigator.vibrate?.(18);

  if (grid.every(row => row.every(v => v !== EMPTY)) && gridIsValid(grid, level.constraints, true)) {
    setTimeout(showWinModal, 180);
  } else {
    renderGame();
  }
}

function useHint() {
  if (hintsLeft + bonusHints <= 0) {
    showToast('Plus d’indice disponible sur cette grille.');
    return;
  }

  const hint = findHint(grid, level.constraints, level.solution);
  if (!hint) return;
  if (bonusHints > 0) bonusHints--; else hintsLeft--;
  hintPosition = hint.position;
  renderGame();
  setTimeout(() => showToast(hint.text), 0);
}

function showToast(text: string) {
  const toast = document.querySelector<HTMLDivElement>('#toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3800);
}

function showThirdErrorModal() {
  const canOfferReward = !bonusOfferShown;
  if (canOfferReward) bonusOfferShown = true;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-symbol">!</div>
      <span class="eyebrow">3 ERREURS</span>
      <h3>${canOfferReward ? 'Besoin d’un coup de pouce ?' : 'Nouvelle tentative ?'}</h3>
      <p>${canOfferReward ? 'Regarde une courte publicité pour obtenir un indice supplémentaire et continuer.' : 'Le coup de pouce bonus a déjà été proposé sur cette grille.'}</p>
      ${canOfferReward ? '<button class="reward-button" id="rewardBtn">▶ Obtenir un indice</button>' : ''}
      <button class="secondary" id="restartBtn">Recommencer le niveau</button>
    </div>`;
  document.body.appendChild(modal);

  document.querySelector('#restartBtn')?.addEventListener('click', () => {
    modal.remove();
    restartCurrentLevel();
  });

  if (canOfferReward) {
    document.querySelector('#rewardBtn')?.addEventListener('click', async () => {
      const btn = document.querySelector<HTMLButtonElement>('#rewardBtn')!;
      btn.disabled = true;
      btn.textContent = 'Chargement…';
      const rewarded = await showRewardedHint();
      if (!rewarded) {
        btn.disabled = false;
        btn.textContent = 'Pub indisponible';
        return;
      }
      bonusHints++;
      errors = 2;
      modal.remove();
      renderGame();
      showToast('Indice supplémentaire débloqué.');
    });
  }
}

function showWinModal() {
  navigator.vibrate?.([25, 35, 25]);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop win-backdrop';
  modal.innerHTML = `
    <div class="modal-card win-card">
      <div class="success-mark">✓</div>
      <span class="eyebrow">BIEN JOUÉ</span>
      <h3>Niveau ${levelNumber} réussi !</h3>
      <p>${errors === 0 ? 'Parfait. Aucune erreur.' : `${errors} erreur${errors > 1 ? 's' : ''}.`}</p>
      <button class="primary" id="nextBtn">Niveau suivant</button>
    </div>`;
  document.body.appendChild(modal);
  document.querySelector('#nextBtn')?.addEventListener('click', () => {
    modal.remove();
    levelNumber++;
    localStorage.setItem(STORAGE_LEVEL, String(levelNumber));
    loadLevel(true);
  });
}

function newVariant() {
  variant = (variant + 1 + (Date.now() & 0xffff)) >>> 0;
}

function restartCurrentLevel() {
  newVariant();
  level = generateLevel(levelNumber, variant);
  grid = cloneGrid(level.initial);
  errors = 0;
  hintsLeft = 3;
  bonusHints = 0;
  bonusOfferShown = false;
  hintPosition = null;
  selected = CIRCLE;
  renderGame();
}

function loadLevel(forceNew = false) {
  if (forceNew) newVariant();
  level = generateLevel(levelNumber, variant);
  grid = cloneGrid(level.initial);
  errors = 0;
  hintsLeft = 3;
  bonusHints = 0;
  bonusOfferShown = false;
  hintPosition = null;
  selected = CIRCLE;
  screen = 'game';
  render();
}

render();
