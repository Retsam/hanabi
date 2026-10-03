import type { Rank, Suit } from "./card";

/**
 * The rules of a game as data. Only the base game exists for now; variants will be added as config
 * plus rule hooks.
 */
export interface GameConfig {
  readonly numPlayers: number;
  readonly handSize: number;
  readonly suits: readonly Suit[];
  /** How many copies of each rank there are in each suit. */
  readonly rankCounts: Readonly<Record<Rank, number>>;
  readonly maxClueTokens: number;
  /** Reaching this many strikes ends the game with a score of 0. */
  readonly maxStrikes: number;
}

const STANDARD_SUITS: readonly Suit[] = ["red", "yellow", "green", "blue", "purple"];

/** The hanab.live base game for 2 to 5 players. */
export function standardConfig(numPlayers: 2 | 3 | 4 | 5): GameConfig {
  return {
    numPlayers,
    handSize: numPlayers <= 3 ? 5 : 4,
    suits: STANDARD_SUITS,
    rankCounts: { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 },
    maxClueTokens: 8,
    maxStrikes: 3,
  };
}
