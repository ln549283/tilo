import { EMPTY, type CellValue, type Constraint, type Grid } from './model';

export function lineIsValid(line: readonly CellValue[], complete = false): boolean {
  const half = line.length / 2;
  const circles = line.filter(v => v === 1).length;
  const diamonds = line.filter(v => v === 2).length;
  if (circles > half || diamonds > half) return false;
  for (let i = 0; i <= line.length - 3; i++) {
    if (line[i] !== EMPTY && line[i] === line[i + 1] && line[i] === line[i + 2]) return false;
  }
  return !complete || (circles === half && diamonds === half && !line.includes(EMPTY));
}

export function constraintIsValid(grid: Grid, constraint: Constraint): boolean {
  const av = grid[constraint.a[0]]?.[constraint.a[1]] ?? EMPTY;
  const bv = grid[constraint.b[0]]?.[constraint.b[1]] ?? EMPTY;
  if (av === EMPTY || bv === EMPTY) return true;
  return constraint.type === 'same' ? av === bv : av !== bv;
}

export function gridIsValid(grid: Grid, constraints: readonly Constraint[] = [], complete = false): boolean {
  for (const row of grid) if (!lineIsValid(row, complete)) return false;
  for (let c = 0; c < grid.length; c++) {
    if (!lineIsValid(grid.map(row => row[c] ?? EMPTY), complete)) return false;
  }
  return constraints.every(constraint => constraintIsValid(grid, constraint));
}
