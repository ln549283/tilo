export type BaseDifficulty = 'Facile' | 'Moyen' | 'Difficile' | 'Extrême';

export type LevelMode = {
  difficulty: BaseDifficulty;
  timed: boolean;
  timeLimitSeconds?: number;
};

const mode = (difficulty: BaseDifficulty, timed = false): LevelMode => ({
  difficulty,
  timed,
  timeLimitSeconds: timed
    ? difficulty === 'Moyen' ? 180
      : difficulty === 'Difficile' ? 150
      : 120
    : undefined,
});

const EASY = mode('Facile');
const MEDIUM = mode('Moyen');
const HARD = mode('Difficile');
const EXTREME = mode('Extrême');
const MEDIUM_TIMED = mode('Moyen', true);
const HARD_TIMED = mode('Difficile', true);
const EXTREME_TIMED = mode('Extrême', true);

export function getLevelMode(level: number): LevelMode {
  if (level <= 4) return EASY;

  // Introduction progressive des variantes, dans cet ordre :
  // Facile → Moyen → Difficile → Moyen Chrono → Extrême → Difficile Chrono → Extrême Chrono.
  if (level <= 12) {
    const cycle = [MEDIUM, EASY, MEDIUM, MEDIUM, EASY, MEDIUM, MEDIUM, MEDIUM];
    return cycle[(level - 5) % cycle.length]!;
  }

  if (level <= 20) {
    const cycle = [HARD, MEDIUM, MEDIUM, HARD, MEDIUM, HARD, MEDIUM, MEDIUM];
    return cycle[(level - 13) % cycle.length]!;
  }

  if (level <= 28) {
    const cycle = [MEDIUM_TIMED, HARD, MEDIUM, MEDIUM_TIMED, HARD, MEDIUM, HARD, MEDIUM_TIMED];
    return cycle[(level - 21) % cycle.length]!;
  }

  if (level <= 36) {
    const cycle = [EXTREME, HARD, MEDIUM_TIMED, HARD, EXTREME, MEDIUM, HARD, MEDIUM_TIMED];
    return cycle[(level - 29) % cycle.length]!;
  }

  if (level <= 44) {
    const cycle = [HARD_TIMED, EXTREME, HARD, MEDIUM_TIMED, HARD, HARD_TIMED, EXTREME, HARD];
    return cycle[(level - 37) % cycle.length]!;
  }

  // Toutes les variantes sont désormais débloquées. On alterne pour éviter
  // les longues séries de niveaux identiques tout en gardant une tendance exigeante.
  const infiniteCycle = [
    EXTREME_TIMED,
    HARD,
    EXTREME,
    MEDIUM_TIMED,
    HARD_TIMED,
    MEDIUM,
    EXTREME,
    HARD,
    MEDIUM_TIMED,
    EXTREME,
    HARD_TIMED,
    HARD,
  ];
  return infiniteCycle[(level - 45) % infiniteCycle.length]!;
}

export function levelModeLabel(level: number) {
  const current = getLevelMode(level);
  return current.timed ? `${current.difficulty} · Chrono` : current.difficulty;
}

export function nextModeUnlock(level: number) {
  const unlocks = [
    { at: 5, label: 'Moyen' },
    { at: 13, label: 'Difficile' },
    { at: 21, label: 'Moyen Chrono' },
    { at: 29, label: 'Extrême' },
    { at: 37, label: 'Difficile Chrono' },
    { at: 45, label: 'Extrême Chrono' },
  ];
  const next = unlocks.find(item => item.at > level);
  if (!next) return null;
  const remaining = next.at - level;
  return {
    ...next,
    remaining,
    text: remaining === 1
      ? `${next.label} au prochain niveau`
      : `${remaining} niveaux avant ${next.label}`,
  };
}
