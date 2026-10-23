// Reviewing a finished game: how each move made ranked among the moves open to its player. See
// docs/ARCHITECTURE.md ("Game review").
import {
  type Action,
  type PlayerView,
  playerView,
  replay,
  type Replay,
  type Seat,
} from "@hanabi/engine";
import type { Level } from "./conventions.ts";
import { rankMoves, type RankedMove } from "./moves.ts";

/** One turn of a review: the move made, judged from its player's view, and the best other move. */
export interface TurnReview {
  /** The turn number before the move, as in `GameState.turn`. */
  readonly turn: number;
  readonly seat: Seat;
  /** The move made, with its category, score and reasons. */
  readonly move: RankedMove;
  /** Its place among the legal moves, from 1. Moves tied on category and score share a place. */
  readonly rank: number;
  /** How many legal moves there were. */
  readonly moves: number;
  /**
   * The highest-ranked move other than the one made, or undefined if there was no other legal move.
   * When the move made is ranked first, this is the runner-up.
   */
  readonly alternative?: RankedMove;
}

/**
 * Judges every move of `record` at the table's `level`, each from the view of the player who made
 * it: what they could know at the time, not the hidden cards. Deterministic.
 */
export function reviewGame(record: Replay, level: Level): TurnReview[] {
  const { states } = replay(record);
  return record.actions.map((action, i) => {
    const state = states[i]!;
    return reviewMove(playerView(state, state.currentPlayer), action, level);
  });
}

/**
 * Judges `action` as the viewer's move at the table's `level`. Throws if it is not one of the
 * viewer's legal moves.
 */
export function reviewMove(view: PlayerView, action: Action, level: Level): TurnReview {
  const ranked = rankMoves(view, level);
  const index = ranked.findIndex((move) => sameAction(move.action, action));
  const move = ranked[index];
  if (move === undefined) {
    throw new Error(`Seat ${view.seat} can't make ${JSON.stringify(action)} on turn ${view.turn}`);
  }
  const rank =
    ranked.findIndex((other) => other.category === move.category && other.score === move.score) + 1;
  const alternative = ranked.find((_, i) => i !== index);
  return {
    turn: view.turn,
    seat: view.seat,
    move,
    rank,
    moves: ranked.length,
    ...(alternative && { alternative }),
  };
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type === "clue" || b.type === "clue") {
    return (
      a.type === "clue" &&
      b.type === "clue" &&
      a.target === b.target &&
      a.clue.kind === b.clue.kind &&
      a.clue.value === b.clue.value
    );
  }
  return a.type === b.type && a.cardId === b.cardId;
}
