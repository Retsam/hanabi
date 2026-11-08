// Looking back mid-game: the table as the human saw it after an earlier move, rebuilt from the
// game's record so nothing they couldn't see then (or has learned since) leaks in.
import { type PlayerView, playerView, type Replay, replay, type Seat } from "@hanabi/engine";

/** The table `seat` saw after the first `moves` moves of `record` (0 is the opening deal). */
export function pastView(record: Replay, seat: Seat, moves: number): PlayerView {
  const actions = record.actions.slice(0, moves);
  return playerView(replay({ ...record, actions }).state, seat);
}

/**
 * Where a step back or forward from `looking` lands in a game of `moves` moves so far. `null` is the
 * live table; stepping forward from the last move made returns to it, and back from it goes to the
 * table before that move. Steps past the opening deal stay there.
 */
export function step(looking: number | null, moves: number, by: -1 | 1): number | null {
  const at = Math.max(0, (looking ?? moves) + by);
  return at >= moves ? null : at;
}
