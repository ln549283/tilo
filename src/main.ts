import './style.css';
import { CIRCLE, DIAMOND, EMPTY, cloneGrid, type FilledValue, type Grid, type Level, type Position } from './core/model';
import { generateLevel } from './core/generator';
import { findHint } from './core/solver';
import { gridIsValid } from './core/rules';
import { initializeAds, showRewardedHint } from './ads';

const STORAGE_LEVEL = 'keite-current-level';
const STORAGE_TUTORIAL = 'keite-tutorial-seen';
const LEGACY_STORAGE_LEVEL = 'tilo-current-level';
const LEGACY_STORAGE_TUTORIAL = 'tilo-tutorial-seen';

const storedLevel = localStorage.getItem(STORAGE_LEVEL) ?? localStorage.getItem(LEGACY_STORAGE_LEVEL);
if (!localStorage.getItem(STORAGE_TUTORIAL) && localStorage.getItem(LEGACY_STORAGE_TUTORIAL)) {
  localStorage.setItem(STORAGE_TUTORIAL, '1');
}

let levelNumber = Math.max(1, Number(storedLevel || 1));
let variant = Date.now() >>> 0;
let level: Level = generateLevel(levelNumber, variant);
let grid: Grid = cloneGrid(level.initial);
let selected: FilledValue = CIRCLE;
let errors = 0;
let hintsLeft = 3;
let lastChanceUsed = false;
let hintPosition: Position | null = null;
let screen: 'home' | 'rules' | 'game' = 'home';
let rulesReturnScreen: 'home' | 'game' = 'home';

const app = document.querySelector<HTMLDivElement>('#app')!;
initializeAds();

function symbol(value: number) {
  if (value === CIRCLE) return '<span class="piece circle" aria-label="cercle violet"></span>';
  if (value === DIAMOND) return '<span class="piece diamond" aria-label="losange vert"></span>';
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
        <img class="keite-wordmark" src="./keite_logo_transparent.png?v=20260917-4" alt="KEITE — Keep It Even" />
      </div>
      <div class="home-bottom">
        <div class="current-level">Niveau ${levelNumber}</div>
        <button class="primary" id="playBtn">Jouer</button>
        <small>Nibylo Games</small>
      </div>
    </main>`;

  document.querySelector('#playBtn')?.addEventListener('click', () => {
    if (localStorage.getItem(STORAGE_TUTORIAL)) screen = 'game';
    else { rulesReturnScreen = 'game'; screen = 'rules'; }
    render();
  });
  document.querySelector('#rulesBtn')?.addEventListener('click', () => {
    rulesReturnScreen = 'home'; screen = 'rules'; render();
  });
}

function renderRules() {
  app.innerHTML = `
    <main class="screen rules-screen">
      <header class="rules-header">
        <button class="ghost-icon" id="backBtn" aria-label="Retour">‹</button>
        <div class="rules-title">
          <h2>Simple à apprendre.</h2>
          <p>Trois règles, une seule logique : l’équilibre.</p>
        </div>
      </header>
      <div class="rules-content">
        <section class="rule-card">
          <b class="rule-number">1</b>
          <div class="rule-copy">
            <strong>Équilibre chaque ligne et chaque colonne.</strong>
            <span>Autant de ${symbol(CIRCLE)} que de ${symbol(DIAMOND)}.</span>
          </div>
          <div class="balance-demo" aria-label="Deux cercles et deux losanges">
            <span class="demo-cell">${symbol(CIRCLE)}</span><span class="demo-cell">${symbol(DIAMOND)}</span><span class="demo-cell">${symbol(CIRCLE)}</span><span class="demo-cell">${symbol(DIAMOND)}</span>
          </div>
        </section>
        <section class="rule-card">
          <b class="rule-number">2</b>
          <div class="rule-copy">
            <strong>Jamais trois symboles identiques à la suite.</strong>
            <span>Ni horizontalement, ni verticalement.</span>
          </div>
          <div class="triple-demos">
            <div class="mini-demo bad"><b>× Incorrect</b><div><span class="demo-cell">${symbol(CIRCLE)}</span><span class="demo-cell">${symbol(CIRCLE)}</span><span class="demo-cell">${symbol(CIRCLE)}</span></div></div>
            <div class="mini-demo good"><b>✓ Correct</b><div><span class="demo-cell">${symbol(CIRCLE)}</span><span class="demo-cell">${symbol(DIAMOND)}</span><span class="demo-cell">${symbol(CIRCLE)}</span></div></div>
          </div>
        </section>
        <section class="rule-card">
          <b class="rule-number">3</b>
          <div class="rule-copy">
            <strong>Respecte les liens.</strong>
            <span><span class="legend-link same-link">=</span> mêmes symboles <span class="rule-separator">·</span> <span class="legend-link different-link">×</span> symboles différents</span>
          </div>
          <div class="link-demos">
            <div class="link-demo"><small>IDENTIQUE</small><div>${symbol(CIRCLE)}<span class="legend-link same-link">=</span>${symbol(CIRCLE)}</div></div>
            <div class="link-demo"><small>DIFFÉRENT</small><div>${symbol(DIAMOND)}<span class="legend-link different-link">×</span>${symbol(CIRCLE)}</div></div>
          </div>
        </section>
      </div>
      <button class="primary rules-return" id="startBtn">${localStorage.getItem(STORAGE_TUTORIAL) ? 'Retour au jeu' : 'J’ai compris'}</button>
    </main>`;

  const returnFromRules = () => { screen = rulesReturnScreen; render(); };
  document.querySelector('#backBtn')?.addEventListener('click', returnFromRules);
  document.querySelector('#startBtn')?.addEventListener('click', () => {
    localStorage.setItem(STORAGE_TUTORIAL, '1');
    returnFromRules();
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

function renderQuickLegend() {
  if (levelNumber > 5) return '';
  return `<div class="quick-legend" aria-label="Rappel des symboles">
      <div class="quick-legend-item">${symbol(CIRCLE)}<span>Cercle violet</span></div>
      <div class="quick-legend-item">${symbol(DIAMOND)}<span>Losange vert</span></div>
      <div class="quick-legend-item"><span class="legend-link same-link">=</span><span>Même</span></div>
      <div class="quick-legend-item"><span class="legend-link different-link">×</span><span>Différent</span></div>
    </div>`;
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
        <div class="header-actions">
          <div class="mistakes" aria-label="Erreurs">${[0,1,2].map(i => `<i class="mistake-dot ${i < errors ? 'used' : ''}"></i>`).join('')}</div>
          <button class="rules-mini" id="gameRulesBtn" aria-label="Règles">?</button>
        </div>
      </header>
      ${renderQuickLegend()}
      <div class="game-objective">Équilibre la grille</div>
      <section class="board-wrap"><div class="board" style="--size:${level.size}">${cells}${constraintMarkup()}</div></section>
      <div class="selector" aria-label="Choisir un symbole">
        <button class="symbol-button circle-choice ${selected === CIRCLE ? 'selected' : ''}" data-value="${CIRCLE}">${symbol(CIRCLE)}</button>
        <button class="symbol-button diamond-choice ${selected === DIAMOND ? 'selected' : ''}" data-value="${DIAMOND}">${symbol(DIAMOND)}</button>
      </div>
      <button class="hint-button" id="hintBtn"><span class="hint-bulb">💡</span><b>Indice</b><em>${hintsLeft}</em></button>
      <div class="balance-reminder">Autant de ${symbol(CIRCLE)} que de ${symbol(DIAMOND)} dans chaque ligne et chaque colonne.</div>
      <div id="toast" class="toast"></div>
    </main>`;

  document.querySelector('#homeBtn')?.addEventListener('click', () => { screen = 'home'; render(); });
  document.querySelector('#gameRulesBtn')?.addEventListener('click', () => { rulesReturnScreen = 'game'; screen = 'rules'; render(); });
  document.querySelectorAll<HTMLButtonElement>('.symbol-button').forEach(btn => btn.addEventListener('click', () => { selected = Number(btn.dataset.value) as FilledValue; renderGame(); }));
  document.querySelectorAll<HTMLButtonElement>('.cell:not(.fixed)').forEach(btn => btn.addEventListener('click', () => playCell(btn)));
  document.querySelector('#hintBtn')?.addEventListener('click', useHint);
}

function playCell(button: HTMLButtonElement) {
  const r = Number(button.dataset.r), c = Number(button.dataset.c), value = selected as number;
  if (value === EMPTY) { grid[r]![c] = EMPTY; hintPosition = null; renderGame(); return; }
  if (value !== level.solution[r]![c]) {
    errors++; navigator.vibrate?.([45,30,45]); button.classList.add('wrong');
    setTimeout(() => { if (errors >= 3) showThirdErrorModal(); else renderGame(); }, 280); return;
  }
  grid[r]![c] = value as FilledValue; hintPosition = null; navigator.vibrate?.(18);
  if (grid.every(row => row.every(v => v !== EMPTY)) && gridIsValid(grid, level.constraints, true)) setTimeout(showWinModal, 180);
  else renderGame();
}

function useHint() {
  if (hintsLeft <= 0) { showToast('Plus d’indice disponible sur cette grille.'); return; }
  const hint = findHint(grid, level.constraints, level.solution); if (!hint) return;
  hintsLeft--; hintPosition = hint.position; renderGame(); setTimeout(() => showToast(hint.text), 0);
}
function showToast(text: string) { const toast = document.querySelector<HTMLDivElement>('#toast'); if (!toast) return; toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3800); }

function showThirdErrorModal() {
  const canOfferLastChance = !lastChanceUsed;
  const modal = document.createElement('div'); modal.className='modal-backdrop';
  modal.innerHTML=`<div class="modal-card"><div class="modal-symbol">!</div><span class="eyebrow">3 ERREURS</span><h3>${canOfferLastChance?'Besoin d’une dernière chance ?':'Cette tentative est terminée.'}</h3><p>${canOfferLastChance?'Regarde une courte publicité pour obtenir une erreur supplémentaire et continuer.':'Ta dernière chance a déjà été utilisée sur cette grille.'}</p>${canOfferLastChance?'<button class="reward-button" id="rewardBtn">▶ Obtenir une dernière chance</button>':''}<button class="secondary" id="restartBtn">Recommencer le niveau</button></div>`;
  document.body.appendChild(modal);
  document.querySelector('#restartBtn')?.addEventListener('click',()=>{modal.remove();restartCurrentLevel();});
  if(canOfferLastChance) document.querySelector('#rewardBtn')?.addEventListener('click',async()=>{const btn=document.querySelector<HTMLButtonElement>('#rewardBtn')!;btn.disabled=true;btn.textContent='Chargement…';const rewarded=await showRewardedHint();if(!rewarded){btn.disabled=false;btn.textContent='Pub indisponible';return;}lastChanceUsed=true;errors=2;modal.remove();renderGame();showToast('Dernière chance activée : une erreur supplémentaire est permise.');});
}
function showWinModal(){navigator.vibrate?.([25,35,25]);const modal=document.createElement('div');modal.className='modal-backdrop win-backdrop';modal.innerHTML=`<div class="modal-card win-card"><div class="success-mark">✓</div><span class="eyebrow">BIEN JOUÉ</span><h3>Niveau ${levelNumber} réussi !</h3><p>${errors===0?'Parfait. Aucune erreur.':`${errors} erreur${errors>1?'s':''}.`}</p><button class="primary" id="nextBtn">Niveau suivant</button></div>`;document.body.appendChild(modal);document.querySelector('#nextBtn')?.addEventListener('click',()=>{modal.remove();levelNumber++;localStorage.setItem(STORAGE_LEVEL,String(levelNumber));loadLevel(true);});}
function newVariant(){variant=(variant+1+(Date.now()&0xffff))>>>0;}
function restartCurrentLevel(){newVariant();level=generateLevel(levelNumber,variant);grid=cloneGrid(level.initial);errors=0;hintsLeft=3;lastChanceUsed=false;hintPosition=null;selected=CIRCLE;renderGame();}
function loadLevel(forceNew=false){if(forceNew)newVariant();level=generateLevel(levelNumber,variant);grid=cloneGrid(level.initial);errors=0;hintsLeft=3;lastChanceUsed=false;hintPosition=null;selected=CIRCLE;screen='game';render();}
render();