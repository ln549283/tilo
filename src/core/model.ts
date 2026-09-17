export const EMPTY = 0 as const;
export const CIRCLE = 1 as const;
export const DIAMOND = 2 as const;

export type CellValue = typeof EMPTY | typeof CIRCLE | typeof DIAMOND;
export type FilledValue = typeof CIRCLE | typeof DIAMOND;
export type Grid = CellValue[][];
export type Position = readonly [row: number, col: number];
export type ConstraintType = 'same' | 'different';

export interface Constraint {
  a: Position;
  b: Position;
  type: ConstraintType;
}

export interface Level {
  number: number;
  size: 4 | 6;
  initial: Grid;
  solution: Grid;
  constraints: Constraint[];
  tier: 'intro' | 'easy' | 'medium' | 'sparse' | 'deep';
}

export const cloneGrid = (grid: Grid): Grid => grid.map(row => [...row]);
export const otherValue = (value: FilledValue): FilledValue => value === CIRCLE ? DIAMOND : CIRCLE;
