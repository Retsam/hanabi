// Actions and the events `apply` returns. See docs/ARCHITECTURE.md ("Actions", "Events").
import type { Card, CardId, Rank, Suit } from "./card";
import type { Seat } from "./state";

export type Clue =
  | { readonly kind: "color"; readonly value: Suit }
  | { readonly kind: "rank"; readonly value: Rank };

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
