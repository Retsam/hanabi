// The data behind the review screen: each turn of a finished game with how the engine judged it.
import {
  type CardId,
  type GameEvent,
  type GameState,
  history,
  type Moment,
  playerView,
  replay,
  type Replay,
} from "@hanabi/engine";
import { type Level, reviewGame, type TurnReview } from "@hanabi/hgroup";
import { chops } from "./describe.ts";

export interface ReviewedTurn {
  /** The engine's judgement of the move, from its player's view. */
  readonly review: TurnReview;
  /** The state the move was made in. */
  readonly state: GameState;
  /** What the move did. */
  readonly event: GameEvent;
  /** The public table the move was made on. */
  readonly moment: Moment;
  /** The mover's chop on that table, as the table agrees it. */
  readonly chop: CardId | null;
}

/**
 * How a move compares with the engine's pick: the top move ("best"), the top move though it breaks a
 * convention because every move does ("forced"), below the top but in the same category ("close"),
 * or in a worse category ("worse").
 */
export type Standing = "best" | "forced" | "close" | "worse";

export function standing({ move, rank, alternative }: TurnReview): Standing {
  if (rank === 1) return move.category === "violates" ? "forced" : "best";
  return move.category === alternative?.category ? "close" : "worse";
}

/** Replays `record` and judges every move at the table's `level`. Takes up to a second for a long game. */
export function reviewTurns(record: Replay, level: Level): ReviewedTurn[] {
  const { states, events, state } = replay(record);
  const moments = history(state);
  // Readings are the same from every seat; any view of the final state will do.
  const chopIds = chops(playerView(state, 0), level);
  return reviewGame(record, level).map((review, i) => ({
    review,
    state: states[i]!,
    event: events[i]!,
    moment: moments[i]!,
    chop: chopIds[i]!,
  }));
}
