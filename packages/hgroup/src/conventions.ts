// The H-Group conventions the engine implements, by the ids in docs/H-GROUP-LEVELS.md, and the level
// each one arrives at. See docs/ARCHITECTURE.md ("Levels").

/**
 * The table's H-Group level, from 1 to 25. Level 0 means no conventions at all: clues carry only
 * their rules-level information.
 */
export type Level = number;

/** The level each implemented convention belongs to. Specs: docs/conventions/. */
export const CONVENTION_LEVELS = {
  chop: 1,
  trash: 1,
  "clue-focus": 1,
  "good-touch": 1,
  "play-clue": 1,
  "delayed-play-clue": 1,
  "save-clue": 1,
  "5-save": 1,
  "2-save": 1,
  "critical-save": 1,
  prompt: 1,
  finesse: 1,
  "finesse-position": 1,
  "finessed-cards-count-as-clued": 1,
  "prompts-before-finesses": 1,
  "save-principle": 1,
  "minimum-clue-value": 1,
  "early-game": 1,
  "5-stall": 2,
  "multi-prompt": 2,
} as const satisfies Record<string, Level>;

export type ConventionId = keyof typeof CONVENTION_LEVELS;

/** The highest level with a convention implemented. */
export const MAX_LEVEL: Level = Math.max(...Object.values(CONVENTION_LEVELS));

/** Whether `convention` is in force at a table playing at `level`. */
export const applies = (convention: ConventionId, level: Level): boolean =>
  CONVENTION_LEVELS[convention] <= level;
