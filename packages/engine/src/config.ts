import type { GameConfig, Rank, Suit } from "./types";

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5];

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
