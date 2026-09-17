import { EMPTY, CIRCLE, DIAMOND, cloneGrid, type Constraint, type FilledValue, type Grid, type Level } from './model';
import { countSolutions } from './solver';
import { gridIsValid } from './rules';

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
  if (!walk(0)) throw new Error('Unable to generate TILO solution');
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

function specFor(level: number) {
  if (level <= 5) return { size: 4 as const, clueRate: .50, constraints: 0, tier: 'intro' as const };
  if (level <= 10) return { size: 4 as const, clueRate: .38, constraints: 2, tier: 'easy' as const };
  if (level <= 30) return { size: 6 as const, clueRate: .42, constraints: 4, tier: 'medium' as const };
  if (level <= 50) return { size: 6 as const, clueRate: .32, constraints: 5, tier: 'sparse' as const };
  if (level <= 69) return { size: 6 as const, clueRate: .27, constraints: 6, tier: 'sparse' as const };
  return { size: 6 as const, clueRate: .22, constraints: 6, tier: 'deep' as const };
}

function mixSeed(number: number, variant: number) {
  let seed = (0x54494c4f ^ Math.imul(number, 0x9e3779b1) ^ Math.imul(variant + 1, 0x85ebca6b)) >>> 0;
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x7feb352d) >>> 0;
  seed ^= seed >>> 15;
  return seed >>> 0;
}

export function generateLevel(number: number, variant = 0): Level {
  const spec = specFor(number);
  const rng = new SeededRandom(mixSeed(number, variant));

  for (let attempt = 0; attempt < 40; attempt++) {
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

    if (countSolutions(initial, constraints, 2) === 1) {
      return { number, size: spec.size, initial, solution, constraints, tier: spec.tier };
    }
  }

  throw new Error(`Unable to generate level ${number}`);
}
