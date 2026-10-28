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
import {
  type Level,
  MAX_LEVEL,
  rankMoves,
  type RankedMove,
  reviewGame,
  reviewMove,
  sameAction,
  type TurnReview,
} from "@hanabi/hgroup";
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
  /** What the engine would pick one level up, when that differs from its pick at this level. */
  readonly preview?: Preview;
}

/** A preview of the next level: the engine's pick there, from the mover's view. */
export interface Preview {
  readonly level: Level;
  /** The next level's top move, judged at that level. */
  readonly move: RankedMove;
  /** Where that move ranks at the table's own level. */
  readonly rank: number;
}

/** The engine's top move in `review`: the move made if it ranked first, else the best other. */
const top = ({ move, rank, alternative }: TurnReview): RankedMove =>
  rank === 1 || alternative === undefined ? move : alternative;

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

/**
 * Replays `record` and judges every move at the table's `level`, previewing the level above where its
 * pick differs. Takes a second or two for a long game.
 */
export function reviewTurns(record: Replay, level: Level): ReviewedTurn[] {
  const { states, events, state } = replay(record);
  const moments = history(state);
  // Readings are the same from every seat; any view of the final state will do.
  const chopIds = chops(playerView(state, 0), level);
  return reviewGame(record, level).map((review, i) => {
    const preview = previewNextLevel(states[i]!, review, level);
    return {
      review,
      state: states[i]!,
      event: events[i]!,
      moment: moments[i]!,
      chop: chopIds[i]!,
      ...(preview && { preview }),
    };
  });
}

/**
 * The engine's pick one level above `level` for the move `review` judged, or undefined if there is
 * no higher level or its pick is no better there than this level's pick (a tie isn't a difference).
 */
export function previewNextLevel(
  state: GameState,
  review: TurnReview,
  level: Level,
): Preview | undefined {
  if (level >= MAX_LEVEL) return undefined;
  const view = playerView(state, review.seat);
  const ranked = rankMoves(view, level + 1);
  const best = ranked[0];
  if (best === undefined) return undefined;
  const pick = top(review).action;
  const tied = ranked.some(
    (move) =>
      move.category === best.category && move.score === best.score && sameAction(move.action, pick),
  );
  if (tied) return undefined;
  return { level: level + 1, move: best, rank: reviewMove(view, best.action, level).rank };
}
