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
let screen: 'home' | 'rules' | 'game' | 'stats' | 'settings' = 'home';

type Difficulty = 'Facile' | 'Moyen' | 'Difficile' | 'Extrême' | 'Chrono';
type GameStat = { level:number; difficulty:Difficulty; errors:number; hints:number; seconds:number; date:string };
type StatsData = { games:GameStat[]; currentPerfectStreak:number; maxPerfectStreak:number };
const STORAGE_STATS = 'keite-stats-v1';
const STORAGE_SOUND = 'keite-sound-enabled';
let soundEnabled = localStorage.getItem(STORAGE_SOUND) !== '0';
let audioContext: AudioContext | null = null;

function tone(frequency:number, duration=.07, volume=.035, type:OscillatorType='sine', delay=0) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new AudioContext();
    const ctx=audioContext, osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.type=type; osc.frequency.value=frequency;
    gain.gain.setValueAtTime(0.0001,ctx.currentTime+delay);
    gain.gain.exponentialRampToValueAtTime(volume,ctx.currentTime+delay+.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+delay+duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime+delay); osc.stop(ctx.currentTime+delay+duration+.02);
  } catch {}
}
function playSound(kind:'tap'|'place'|'error'|'hint'|'win'|'lose') {
  if(kind==='tap') tone(420,.035,.018,'sine');
  if(kind==='place') tone(620,.055,.025,'sine');
  if(kind==='error'){tone(180,.09,.035,'triangle');tone(145,.1,.025,'triangle',.07);}
  if(kind==='hint'){tone(760,.07,.025,'sine');tone(980,.1,.025,'sine',.07);}
  if(kind==='win'){tone(523,.09,.03,'sine');tone(659,.09,.03,'sine',.1);tone(784,.16,.035,'sine',.2);}
  if(kind==='lose'){tone(260,.1,.03,'triangle');tone(205,.13,.03,'triangle',.11);}
}
let gameStartedAt = Date.now();
let hintsUsedThisGame = 0;
function difficultyFor(n:number):Difficulty { if(n<=10)return 'Facile'; if(n<=30)return 'Moyen'; if(n<=50)return 'Difficile'; if(n<=69)return 'Extrême'; return 'Chrono'; }
function readStats():StatsData { try { const v=JSON.parse(localStorage.getItem(STORAGE_STATS)||''); if(v?.games) return v; } catch {} return {games:[],currentPerfectStreak:0,maxPerfectStreak:0}; }
function saveWinStat(){
  const s=readStats(); const perfect=errors===0;
  s.currentPerfectStreak=perfect?s.currentPerfectStreak+1:0;
  s.maxPerfectStreak=Math.max(s.maxPerfectStreak,s.currentPerfectStreak);
  s.games.push({level:levelNumber,difficulty:difficultyFor(levelNumber),errors,hints:hintsUsedThisGame,seconds:Math.max(1,Math.round((Date.now()-gameStartedAt)/1000)),date:new Date().toISOString()});
  localStorage.setItem(STORAGE_STATS,JSON.stringify(s));
}
function formatTime(seconds:number){const m=Math.floor(seconds/60),s=seconds%60;return m? `${m}m ${String(s).padStart(2,'0')}s`:`${s}s`;}

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
  if (screen === 'stats') return renderStats();
  if (screen === 'settings') return renderSettings();
  return renderGame();
}

function renderHome() {
  app.innerHTML = `
    <main class="screen home-screen">
      <div class="home-decor home-decor-purple"></div>
      <div class="home-decor home-decor-green"></div>
      <div class="home-hero">
        <img class="keite-wordmark" src="./keite_logo_transparent.png?v=20260917-4" alt="KEITE — Keep It Even" />
        <p>Un puzzle de logique. Simple à comprendre, difficile à lâcher.</p>
      </div>
      <section class="home-progress">
        <span class="home-progress-label">NIVEAU ACTUEL</span>
        <strong>${levelNumber}</strong>
        <span class="home-infinite">Progression infinie ∞</span>
      </section>
      <button class="primary home-play" id="playBtn"><span>▶</span> Jouer</button>
      <div class="home-actions">
        <button class="home-action" id="statsBtn" type="button">
          <span class="home-action-icon">▥</span><span><b>Statistiques</b><small>Votre progression</small></span><i>›</i>
        </button>
        <button class="home-action" id="rulesBtn" type="button">
          <span class="home-action-icon">?</span><span><b>Règles</b><small>Comment jouer</small></span><i>›</i>
        </button>
        <button class="home-action home-settings-link" id="settingsBtn" type="button">
          <span class="home-action-icon">⚙</span><span><b>Paramètres</b><small>Son et préférences</small></span><i>›</i>
        </button>
      </div>
      <small class="home-studio">Nibylo Games</small>
    </main>`;

  document.querySelector('#playBtn')?.addEventListener('click', () => {
    if (localStorage.getItem(STORAGE_TUTORIAL)) screen = 'game';
    else { rulesReturnScreen = 'game'; screen = 'rules'; }
    render();
  });
  document.querySelector('#statsBtn')?.addEventListener('click', () => { playSound('tap'); screen = 'stats'; render(); });
  document.querySelector('#settingsBtn')?.addEventListener('click', () => { playSound('tap'); screen = 'settings'; render(); });
  document.querySelector('#rulesBtn')?.addEventListener('click', () => {
    rulesReturnScreen = 'home'; screen = 'rules'; render();
  });
}


function renderSettings() {
  app.innerHTML=`
    <main class="screen settings-screen">
      <header class="settings-header"><button class="ghost-icon" id="settingsBack" aria-label="Retour">‹</button><div><h2>Paramètres</h2><p>Personnalisez votre expérience.</p></div></header>
      <section class="settings-list">
        <div class="setting-row">
          <div class="setting-icon">♪</div>
          <div class="setting-copy"><b>Effets sonores</b><span>Sons des placements, indices et résultats</span></div>
          <button class="switch ${soundEnabled?'on':''}" id="soundToggle" role="switch" aria-checked="${soundEnabled}"><i></i></button>
        </div>
        <div class="setting-note"><b>KEITE reste discret.</b><span>Pas de musique de fond : uniquement de courts effets sonores pendant la partie.</span></div>
      </section>
      <button class="primary settings-return" id="settingsReturn">← &nbsp; Retour à l’accueil</button>
    </main>`;
  const back=()=>{playSound('tap');screen='home';render();};
  document.querySelector('#settingsBack')?.addEventListener('click',back);
  document.querySelector('#settingsReturn')?.addEventListener('click',back);
  document.querySelector('#soundToggle')?.addEventListener('click',()=>{
    soundEnabled=!soundEnabled; localStorage.setItem(STORAGE_SOUND,soundEnabled?'1':'0');
    if(soundEnabled) playSound('hint'); renderSettings();
  });
}

function renderStats() {
  const s=readStats(), games=s.games, wins=games.length, perfect=games.filter(g=>g.errors===0).length;
  const hints=games.reduce((a,g)=>a+g.hints,0), avg=wins?Math.round(games.reduce((a,g)=>a+g.seconds,0)/wins):0;
  const diffs:Difficulty[]=['Facile','Moyen','Difficile','Extrême','Chrono'];
  const diffHtml=diffs.map(d=>{const n=games.filter(g=>g.difficulty===d).length;const p=wins?Math.round(n/wins*100):0;return `<div class="diff-stat"><i></i><b>${d}</b><strong>${n}</strong><small>${p} %</small></div>`}).join('');
  const recent=[...games].reverse().slice(0,4).map(g=>`<div class="stat-row"><b>#${g.level}</b><span>${g.difficulty}</span><span class="success-pill">Réussi</span><span>${g.errors}</span><span>${g.hints}</span><span>${formatTime(g.seconds)}</span></div>`).join('');
  app.innerHTML=`
  <main class="screen stats-screen">
    <header class="stats-header"><button class="ghost-icon" id="statsBack">‹</button><div><h2>Statistiques</h2><p>Votre progression en un coup d’œil !</p></div></header>
    <div class="stats-scroll">
      <section class="stats-summary">
        <div class="summary-card"><span>Niveau actuel</span><strong>${levelNumber}</strong></div>
        <div class="summary-card"><span>Grilles réussies</span><strong>${wins}</strong></div>
      </section>
      <section class="metric-grid">
        <div class="metric-card"><b>🏆 ${perfect}</b><span>Grilles parfaites</span><small>(0 erreur)</small></div>
        <div class="metric-card"><b>🔥 ${s.maxPerfectStreak}</b><span>Série parfaite max</span></div>
        <div class="metric-card"><b>💡 ${hints}</b><span>Indices utilisés</span><small>${wins?(hints/wins).toFixed(1).replace('.',','):'0'} / grille</small></div>
        <div class="metric-card"><b>◷ ${wins?formatTime(avg):'—'}</b><span>Temps moyen</span><small>par grille</small></div>
      </section>
      <section class="stats-card"><h3>Répartition par difficulté</h3><p>Nombre de grilles réussies dans chaque difficulté</p><div class="difficulty-grid">${diffHtml}</div></section>
      <section class="streak-card"><div><h3>🔥 Votre meilleure série</h3><strong>${s.maxPerfectStreak}</strong> <span>grilles parfaites d’affilée</span></div><div class="advice"><h3>💡 Conseil</h3><p>Analyse d’abord les lignes et colonnes avec le moins de cases possibles.</p></div></section>
      <section class="stats-card recent-card"><h3>Dernières parties</h3><div class="stat-table-head"><span>#</span><span>Difficulté</span><span>Résultat</span><span>Erreurs</span><span>Indices</span><span>Temps</span></div>${recent||'<p class="empty-stats">Terminez une grille pour commencer vos statistiques.</p>'}</section>
    </div>
    <button class="primary stats-return" id="statsReturn">← &nbsp; Retour à l’accueil</button>
  </main>`;
  document.querySelector('#statsBack')?.addEventListener('click',()=>{screen='home';render();});
  document.querySelector('#statsReturn')?.addEventListener('click',()=>{screen='home';render();});
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
    playSound('error'); errors++; navigator.vibrate?.([45,30,45]); button.classList.add('wrong');
    setTimeout(() => { if (errors >= 3) showThirdErrorModal(); else renderGame(); }, 280); return;
  }
  grid[r]![c] = value as FilledValue; hintPosition = null; playSound('place'); navigator.vibrate?.(18);
  if (grid.every(row => row.every(v => v !== EMPTY)) && gridIsValid(grid, level.constraints, true)) setTimeout(showWinModal, 180);
  else renderGame();
}

function useHint() {
  if (hintsLeft <= 0) { showToast('Plus d’indice disponible sur cette grille.'); return; }
  const hint = findHint(grid, level.constraints, level.solution); if (!hint) return;
  hintsLeft--; hintsUsedThisGame++; playSound('hint'); hintPosition = hint.position; renderGame(); setTimeout(() => showToast(hint.text), 0);
}
function showToast(text: string) { const toast = document.querySelector<HTMLDivElement>('#toast'); if (!toast) return; toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3800); }

function showThirdErrorModal() {
  playSound('lose');
  const canOfferLastChance = !lastChanceUsed;
  const modal = document.createElement('div'); modal.className='modal-backdrop';
  modal.innerHTML=`<div class="modal-card"><div class="modal-symbol">!</div><span class="eyebrow">3 ERREURS</span><h3>${canOfferLastChance?'Besoin d’une dernière chance ?':'Cette tentative est terminée.'}</h3><p>${canOfferLastChance?'Regarde une courte publicité pour obtenir une erreur supplémentaire et continuer.':'Ta dernière chance a déjà été utilisée sur cette grille.'}</p>${canOfferLastChance?'<button class="reward-button" id="rewardBtn">▶ Obtenir une dernière chance</button>':''}<button class="secondary" id="restartBtn">Recommencer le niveau</button></div>`;
  document.body.appendChild(modal);
  document.querySelector('#restartBtn')?.addEventListener('click',()=>{modal.remove();restartCurrentLevel();});
  if(canOfferLastChance) document.querySelector('#rewardBtn')?.addEventListener('click',async()=>{const btn=document.querySelector<HTMLButtonElement>('#rewardBtn')!;btn.disabled=true;btn.textContent='Chargement…';const rewarded=await showRewardedHint();if(!rewarded){btn.disabled=false;btn.textContent='Pub indisponible';return;}lastChanceUsed=true;errors=2;modal.remove();renderGame();showToast('Dernière chance activée : une erreur supplémentaire est permise.');});
}
function showWinModal(){saveWinStat();playSound('win');navigator.vibrate?.([25,35,25]);const modal=document.createElement('div');modal.className='modal-backdrop win-backdrop';modal.innerHTML=`<div class="modal-card win-card"><div class="success-mark">✓</div><span class="eyebrow">BIEN JOUÉ</span><h3>Niveau ${levelNumber} réussi !</h3><p>${errors===0?'Parfait. Aucune erreur.':`${errors} erreur${errors>1?'s':''}.`}</p><button class="primary" id="nextBtn">Niveau suivant</button></div>`;document.body.appendChild(modal);document.querySelector('#nextBtn')?.addEventListener('click',()=>{modal.remove();levelNumber++;localStorage.setItem(STORAGE_LEVEL,String(levelNumber));loadLevel(true);});}
function newVariant(){variant=(variant+1+(Date.now()&0xffff))>>>0;}
function restartCurrentLevel(){gameStartedAt=Date.now();hintsUsedThisGame=0;newVariant();level=generateLevel(levelNumber,variant);grid=cloneGrid(level.initial);errors=0;hintsLeft=3;lastChanceUsed=false;hintPosition=null;selected=CIRCLE;renderGame();}
function loadLevel(forceNew=false){gameStartedAt=Date.now();hintsUsedThisGame=0;if(forceNew)newVariant();level=generateLevel(levelNumber,variant);grid=cloneGrid(level.initial);errors=0;hintsLeft=3;lastChanceUsed=false;hintPosition=null;selected=CIRCLE;screen='game';render();}
render();