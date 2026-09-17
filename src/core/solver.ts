import { EMPTY, CIRCLE, DIAMOND, cloneGrid, type Constraint, type FilledValue, type Grid, type Position } from './model';
import { gridIsValid } from './rules';

function candidates(grid: Grid, constraints: readonly Constraint[], r: number, c: number): FilledValue[] {
  const values: FilledValue[] = [CIRCLE, DIAMOND];
  return values.filter(value => {
    grid[r]![c] = value;
    const valid = gridIsValid(grid, constraints);
    grid[r]![c] = EMPTY;
    return valid;
  });
}

function choose(grid: Grid, constraints: readonly Constraint[]) {
  let best: { pos: Position; values: FilledValue[] } | null = null;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (grid[r]![c] !== EMPTY) continue;
      const values = candidates(grid, constraints, r, c);
      if (!best || values.length < best.values.length) best = { pos: [r, c], values };
      if (values.length < 2) return best;
    }
  }
  return best;
}

export function solveGrid(initial: Grid, constraints: readonly Constraint[] = []): Grid | null {
  const grid = cloneGrid(initial);
  const walk = (): boolean => {
    const next = choose(grid, constraints);
    if (!next) return gridIsValid(grid, constraints, true);
    const [r, c] = next.pos;
    for (const value of next.values) {
      grid[r]![c] = value;
      if (walk()) return true;
    }
    grid[r]![c] = EMPTY;
    return false;
  };
  return walk() ? grid : null;
}

export function countSolutions(initial: Grid, constraints: readonly Constraint[] = [], limit = 2): number {
  const grid = cloneGrid(initial);
  let total = 0;
  const walk = () => {
    if (total >= limit) return;
    const next = choose(grid, constraints);
    if (!next) {
      if (gridIsValid(grid, constraints, true)) total++;
      return;
    }
    const [r, c] = next.pos;
    for (const value of next.values) {
      grid[r]![c] = value;
      walk();
    }
    grid[r]![c] = EMPTY;
  };
  walk();
  return total;
}

export function findHint(grid: Grid, constraints: readonly Constraint[], solution: Grid): { position: Position; value: FilledValue; text: string } | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (grid[r]![c] !== EMPTY) continue;
      const possible = candidates(grid, constraints, r, c);
      if (possible.length === 1) {
        return {
          position: [r, c],
          value: possible[0]!,
          text: `Regarde la ligne ${r + 1} et la colonne ${c + 1} : cette case n'a qu'une valeur possible.`
        };
      }
    }
  }

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (grid[r]![c] === EMPTY) {
        return {
          position: [r, c],
          value: solution[r]![c] as FilledValue,
          text: `Observe la case ligne ${r + 1}, colonne ${c + 1}. Essaie de raisonner par élimination.`
        };
      }
    }
  }
  return null;
}
