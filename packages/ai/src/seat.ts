// Seat controllers: how a seat, AI or (later) human, chooses its moves. See docs/ARCHITECTURE.md
// ("Seats and AIs").
import type { Action, GameEvent, PlayerView } from "@hanabi/engine";
import { type Level, rankMoves, type RankedMove } from "@hanabi/hgroup";
import { uniformInt } from "pure-rand/distribution/uniformInt";
import type { RandomGenerator } from "pure-rand/types/RandomGenerator";

export interface SeatController {
  /** Picks the seat's next action from its view. Called only on the seat's turn. */
  chooseAction(view: PlayerView): Promise<Action>;
  /** Told about every event, the seat's own included, with the seat's view after it. */
  observe?(event: GameEvent, view: PlayerView): void;
}

/** Wraps a synchronous move picker as a seat controller. */
export function syncSeat(choose: (view: PlayerView) => Action): SeatController {
  return { chooseAction: (view) => Promise.resolve(choose(view)) };
}

/**
 * Occasional mistakes for a seat: on each turn, with probability `rate`, it plays one of the
 * engine's next `among` best moves (picked uniformly) instead of the best one. `rng` is advanced in
 * place, so seats that share it draw from one seeded stream.
 */
export interface Noise {
  readonly rate: number;
  readonly rng: RandomGenerator;
  readonly among: number;
}

/**
 * A seat that plays the H-Group decision engine's top-ranked move at the table's `level`, or with
 * `noise` sometimes a worse one. `onChoose`, when given, sees the chosen move with its category and
 * reasons.
 */
export function hgroupSeat(
  level: Level,
  onChoose?: (move: RankedMove, view: PlayerView) => void,
  noise?: Noise,
): SeatController {
  return syncSeat((view) => {
    const ranked = rankMoves(view, level);
    const [top] = ranked;
    if (top === undefined) throw new Error(`Seat ${view.seat} has no legal move`);
    const move = noise && ranked.length > 1 ? (mistake(ranked, noise) ?? top) : top;
    onChoose?.(move, view);
    return move.action;
  });
}

const RESOLUTION = 1_000_000;

/** A worse move than the top one, or undefined when the seat plays its best this turn. */
function mistake(ranked: readonly RankedMove[], { rate, rng, among }: Noise) {
  if (uniformInt(rng, 0, RESOLUTION - 1) >= rate * RESOLUTION) return undefined;
  return ranked[uniformInt(rng, 1, Math.min(among, ranked.length - 1))];
}
