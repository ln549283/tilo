import { EMPTY, CIRCLE, DIAMOND, cloneGrid, type Constraint, type FilledValue, type Grid, type Level } from './model';
import { countSolutions } from './solver';
import { gridIsValid } from './rules';
import { getLevelMode } from './progression';

class SeededRandom {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next() { this.state = (this.state * 1664525 + 1013904223) >>> 0; return this.state / 4294967296; }
  int(max: number) { return Math.floor(this.next() * max); }
  shuffle<T>(items: T[]) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }
}

function makeSolution(size: 4 | 6, rng: SeededRandom): Grid {
  const grid: Grid = Array.from({ length: size }, () => Array(size).fill(EMPTY));
  const walk = (at: number): boolean => {
    if (at === size * size) return gridIsValid(grid, [], true);
    const r = Math.floor(at / size);
    const c = at % size;
    for (const value of rng.shuffle<FilledValue>([CIRCLE, DIAMOND])) {
      grid[r]![c] = value;
      if (gridIsValid(grid) && walk(at + 1)) return true;
    }
    grid[r]![c] = EMPTY;
    return false;
  };
  if (!walk(0)) throw new Error('Unable to generate KEITE solution');
  return grid;
}

function makeConstraints(solution: Grid, rng: SeededRandom, count: number): Constraint[] {
  const pairs: Constraint[] = [];
  const size = solution.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (c + 1 < size) pairs.push({ a: [r, c], b: [r, c + 1], type: solution[r]![c] === solution[r]![c + 1] ? 'same' : 'different' });
      if (r + 1 < size) pairs.push({ a: [r, c], b: [r + 1, c], type: solution[r]![c] === solution[r + 1]![c] ? 'same' : 'different' });
    }
  }
  return rng.shuffle(pairs).slice(0, count);
}

type Spec = {
  size: 4 | 6;
  clueRate: number;
  constraints: number;
  tier: Level['tier'];
  target: readonly [number, number];
};

function specFor(level: number): Spec {
  const { difficulty } = getLevelMode(level);

  if (difficulty === 'Facile') {
    return { size: 4, clueRate: .52, constraints: level % 3 === 0 ? 1 : 0, tier: 'easy', target: [6, 28] };
  }

  if (difficulty === 'Moyen') {
    return { size: 6, clueRate: .60, constraints: 3, tier: 'medium', target: [14, 44] };
  }

  if (difficulty === 'Difficile') {
    return { size: 6, clueRate: .43, constraints: 4, tier: 'sparse', target: [34, 78] };
  }

  return { size: 6, clueRate: .29, constraints: 4, tier: 'deep', target: [58, 132] };
}

function legalValues(grid: Grid, constraints: readonly Constraint[], r: number, c: number): FilledValue[] {
  const values: FilledValue[] = [CIRCLE, DIAMOND];
  return values.filter(value => {
    grid[r]![c] = value;
    const valid = gridIsValid(grid, constraints);
    grid[r]![c] = EMPTY;
    return valid;
  });
}

function measureComplexity(initial: Grid, constraints: readonly Constraint[]): number {
  const grid = cloneGrid(initial);
  const emptyCount = grid.flat().filter(v => v === EMPTY).length;
  let nodes = 0;
  let guesses = 0;
  let maxGuessDepth = 0;

  const walk = (guessDepth: number): boolean => {
    let best: { r:number; c:number; values:FilledValue[] } | null = null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid.length; c++) {
        if (grid[r]![c] !== EMPTY) continue;
        const values = legalValues(grid, constraints, r, c);
        if (values.length === 0) return false;
        if (!best || values.length < best.values.length) best = { r, c, values };
        if (values.length === 1) break;
      }
      if (best?.values.length === 1) break;
    }

    if (!best) return gridIsValid(grid, constraints, true);

    nodes++;
    const branches = best.values.length;
    const nextDepth = branches > 1 ? guessDepth + 1 : guessDepth;
    if (branches > 1) {
      guesses++;
      maxGuessDepth = Math.max(maxGuessDepth, nextDepth);
    }

    for (const value of best.values) {
      grid[best.r]![best.c] = value;
      if (walk(nextDepth)) return true;
    }

    grid[best.r]![best.c] = EMPTY;
    return false;
  };

  walk(0);

  // Empty cells measure visual workload. Guess branches and depth carry much
  // more weight so a sparse-but-obvious grid is not mislabeled "Extrême".
  return emptyCount + guesses * 8 + maxGuessDepth * 12 + Math.min(nodes, 120) * .12 - constraints.length * 1.25;
}

function distanceToRange(value: number, [min, max]: readonly [number, number]) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function mixSeed(number: number, variant: number) {
  let seed = (0x4b454954 ^ Math.imul(number, 0x9e3779b1) ^ Math.imul(variant + 1, 0x85ebca6b)) >>> 0;
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x7feb352d) >>> 0;
  seed ^= seed >>> 15;
  return seed >>> 0;
}

export function generateLevel(number: number, variant = 0): Level {
  const spec = specFor(number);
  const rng = new SeededRandom(mixSeed(number, variant));
  let best: { level:Level; distance:number } | null = null;

  for (let attempt = 0; attempt < 72; attempt++) {
    const solution = makeSolution(spec.size, rng);
    const constraints = makeConstraints(solution, rng, spec.constraints);
    const initial = cloneGrid(solution);
    const cells = rng.shuffle(Array.from({ length: spec.size * spec.size }, (_, i) => i));
    const minClues = Math.max(spec.size, Math.ceil(spec.size * spec.size * spec.clueRate));

    for (const cell of cells) {
      if (initial.flat().filter(v => v !== EMPTY).length <= minClues) break;
      const r = Math.floor(cell / spec.size);
      const c = cell % spec.size;
      const old = initial[r]![c]!;
      initial[r]![c] = EMPTY;
      if (countSolutions(initial, constraints, 2) !== 1) initial[r]![c] = old;
    }

    if (countSolutions(initial, constraints, 2) !== 1) continue;

    const candidate: Level = { number, size: spec.size, initial, solution, constraints, tier: spec.tier };
    const score = measureComplexity(initial, constraints);
    const distance = distanceToRange(score, spec.target);

    if (distance === 0) return candidate;
    if (!best || distance < best.distance) best = { level: candidate, distance };
  }

  if (best) return best.level;
  throw new Error(`Unable to generate level ${number}`);
}
