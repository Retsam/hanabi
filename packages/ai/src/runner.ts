// The headless game runner: plays a game to the end with one seat controller per seat.
import {
  type Action,
  apply,
  type GameEvent,
  type GameState,
  playerView,
  validate,
} from "@hanabi/engine";
import type { SeatController } from "./seat";

export interface GameRun {
  /** The state once the game is over. Its `log` holds every event. */
  readonly state: GameState;
  /** Every action taken, oldest first. With the config and deck, they make the game's replay. */
  readonly actions: readonly Action[];
}

/**
 * Plays from `start` until the game is over, asking the current seat's controller for each move
 * and showing every seat its view of each event. `onEvent` sees each event with the full state
 * after it. Throws if a controller picks an illegal action, naming the seat and turn.
 */
export async function runGame(
  start: GameState,
  seats: readonly SeatController[],
  onEvent?: (event: GameEvent, state: GameState) => void,
): Promise<GameRun> {
  if (seats.length !== start.config.numPlayers) {
    throw new Error(`Got ${seats.length} seats for ${start.config.numPlayers} players`);
  }
  let state = start;
  const actions: Action[] = [];
  while (state.status !== "over") {
    const seat = state.currentPlayer;
    const action = await seats[seat]!.chooseAction(playerView(state, seat));
    const illegal = validate(state, action);
    if (illegal !== null) {
      throw new Error(`Seat ${seat} chose an illegal action on turn ${state.turn}: ${illegal}`);
    }
    const result = apply(state, action);
    state = result.state;
    actions.push(action);
    onEvent?.(result.event, state);
    for (const [i, each] of seats.entries()) each.observe?.(result.event, playerView(state, i));
  }
  return { state, actions };
}
