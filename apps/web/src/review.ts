// The data behind the review screen: each turn of a finished game with how the engine judged it.
import {
  type GameEvent,
  type GameState,
  history,
  type Moment,
  replay,
  type Replay,
} from "@hanabi/engine";
import { type Level, reviewGame, type TurnReview } from "@hanabi/hgroup";

export interface ReviewedTurn {
  /** The engine's judgement of the move, from its player's view. */
  readonly review: TurnReview;
  /** The state the move was made in. */
  readonly state: GameState;
  /** What the move did. */
  readonly event: GameEvent;
  /** The public table the move was made on. */
  readonly moment: Moment;
}

/** Replays `record` and judges every move at the table's `level`. Takes up to a second for a long game. */
export function reviewTurns(record: Replay, level: Level): ReviewedTurn[] {
  const { states, events, state } = replay(record);
  const moments = history(state);
  return reviewGame(record, level).map((review, i) => ({
    review,
    state: states[i]!,
    event: events[i]!,
    moment: moments[i]!,
  }));
}
