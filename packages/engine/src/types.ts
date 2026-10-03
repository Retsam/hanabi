// Core data types for the engine. See docs/ARCHITECTURE.md ("State shape", "Actions", "Events").

/** A suit id, as listed in `GameConfig.suits` (for example "red"). */
export type Suit = string;

export type Rank = 1 | 2 | 3 | 4 | 5;

/** A card's identity. */
export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** A card's index in the dealt deck. Stable for the whole game, like hanab.live's `order`. */
export type CardId = number;

/** A player's position at the table, from 0 to `numPlayers - 1`. */
export type Seat = number;

export type Clue =
  | { readonly kind: "color"; readonly value: Suit }
  | { readonly kind: "rank"; readonly value: Rank };

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

/** The clues a card has been present for, split by whether the clue touched it. */
export interface ClueKnowledge {
  readonly touchedBy: readonly Clue[];
  readonly notTouchedBy: readonly Clue[];
}

export interface CardState {
  readonly id: CardId;
  readonly card: Card;
  readonly clues: ClueKnowledge;
}

export type Status = "playing" | "finalRound" | "over";

export interface GameState {
  readonly config: GameConfig;
  /** Every card in the game, indexed by `CardId`. */
  readonly cards: readonly CardState[];
  /** Each seat's hand, newest card first (hanab.live's slot 1 is index 0). */
  readonly hands: readonly (readonly CardId[])[];
  /** The draw pile, next card to be drawn first. */
  readonly drawPile: readonly CardId[];
  /** The discard pile, in the order cards were discarded or misplayed. */
  readonly discardPile: readonly CardId[];
  /** The highest rank played on each suit's stack, or 0 if none. */
  readonly stacks: Readonly<Record<Suit, number>>;
  readonly clueTokens: number;
  readonly strikes: number;
  readonly currentPlayer: Seat;
  /** Turns left once the draw pile is empty (status "finalRound"), otherwise null. */
  readonly turnsRemaining: number | null;
  /** How many actions have been applied so far. */
  readonly turn: number;
  readonly status: Status;
}

/** Actions never name the acting player (it is always `currentPlayer`) and reference cards by id. */
export type Action =
  | { readonly type: "play"; readonly cardId: CardId }
  | { readonly type: "discard"; readonly cardId: CardId }
  | { readonly type: "clue"; readonly target: Seat; readonly clue: Clue };

/** What an action revealed, returned by `apply` alongside the new state. */
export type GameEvent =
  | {
      readonly type: "play";
      readonly seat: Seat;
      readonly cardId: CardId;
      readonly card: Card;
      readonly success: boolean;
      /** The card drawn to replace it, or null if the draw pile was empty. */
      readonly drawn: CardId | null;
    }
  | {
      readonly type: "discard";
      readonly seat: Seat;
      readonly cardId: CardId;
      readonly card: Card;
      readonly drawn: CardId | null;
    }
  | {
      readonly type: "clue";
      readonly seat: Seat;
      readonly target: Seat;
      readonly clue: Clue;
      readonly touched: readonly CardId[];
    };
