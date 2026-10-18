// Seat controllers: how a seat, AI or (later) human, chooses its moves. See docs/ARCHITECTURE.md
// ("Seats and AIs").
import type { Action, GameEvent, PlayerView } from "@hanabi/engine";
import { type Level, rankMoves, type RankedMove } from "@hanabi/hgroup";

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
 * A seat that plays the H-Group decision engine's top-ranked move at the table's `level`.
 * `onChoose`, when given, sees the chosen move with its category and reasons.
 */
export function hgroupSeat(
  level: Level,
  onChoose?: (move: RankedMove, view: PlayerView) => void,
): SeatController {
  return syncSeat((view) => {
    const [top] = rankMoves(view, level);
    if (top === undefined) throw new Error(`Seat ${view.seat} has no legal move`);
    onChoose?.(top, view);
    return top.action;
  });
}
