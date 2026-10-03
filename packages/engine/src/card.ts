/** A suit id, as listed in `GameConfig.suits` (for example "red"). */
export type Suit = string;

export type Rank = 1 | 2 | 3 | 4 | 5;

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5];

/** A card's identity. */
export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** A card's index in the dealt deck. Stable for the whole game, like hanab.live's `order`. */
export type CardId = number;
