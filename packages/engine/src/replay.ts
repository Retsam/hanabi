// Replays: a game recorded as its config, dealt deck and action list. See docs/ARCHITECTURE.md ("Replays").
import { type Action, apply, type GameEvent } from "./actions";
import type { Card } from "./card";
import type { GameConfig } from "./config";
import { createGame, type GameState } from "./state";

/**
 * A complete record of a game. The deck is stored rather than a seed, so replays survive changes to
 * the PRNG.
 */
export interface Replay {
  readonly config: GameConfig;
  readonly deck: readonly Card[];
  readonly actions: readonly Action[];
}

export interface ReplayResult {
  /** The state before any action, then the state after each action: `actions.length + 1` states. */
  readonly states: readonly GameState[];
  /** The event each action produced, in order. */
  readonly events: readonly GameEvent[];
  /** The state after the last action. */
  readonly state: GameState;
}

/**
 * Deals the replay's deck and applies its actions in order, keeping every intermediate state. Throws
 * if the deck does not match the config or an action is illegal, naming the turn it happened on.
 */
export function replay({ config, deck, actions }: Replay): ReplayResult {
  let state = createGame(config, deck);
  const states: GameState[] = [state];
  const events: GameEvent[] = [];
  for (const [turn, action] of actions.entries()) {
    let result: ReturnType<typeof apply>;
    try {
      result = apply(state, action);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Replay failed on turn ${turn}: ${reason}`, { cause: error });
    }
    state = result.state;
    states.push(state);
    events.push(result.event);
  }
  return { states, events, state };
}
