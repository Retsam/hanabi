import { describe, expect, it } from "vitest";
import type { Action } from "./actions.ts";
import { type Replay, replay } from "./replay.ts";
import { createGame } from "./state.ts";
import { deal, type Scenario } from "./testing/scenario.ts";

const ALICE = 0;
const BOB = 1;

/** The config, dealt deck and actions of a scenario. Card ids are deck indices. */
const recordOf = (game: Scenario): Replay => ({
  config: game.state.config,
  deck: game.state.cards.map(({ card }) => card),
  actions: game.actions,
});

// No draw pile is given, so the scenario's start is exactly createGame on its deck.
const start = () =>
  deal({
    hands: [
      ["r1", "r2", "y1", "b4", "p5"],
      ["g1", "r3", "y2", "b1", "p4"],
    ],
  });

describe("replay", () => {
  it("reproduces the states and events of a game", () => {
    const first = start();
    const game = first.play(0).clue(ALICE, 2).play(0).discard(4).clue(BOB, "green");
    const result = replay(recordOf(game));

    expect(result.state).toEqual(game.state);
    expect(result.events).toEqual(game.events);
    expect(result.states).toHaveLength(6);
    expect(result.states[0]).toEqual(first.state);
    expect(result.states.at(-1)).toBe(result.state);
  });

  it("returns only the dealt state when there are no actions", () => {
    const { config, deck } = recordOf(start());
    const result = replay({ config, deck, actions: [] });
    expect(result.state).toEqual(createGame(config, deck));
    expect(result.states).toEqual([result.state]);
    expect(result.events).toEqual([]);
  });

  it("names the turn of an illegal action", () => {
    const { config, deck, actions } = recordOf(start().play(0));
    const playR1 = actions[0]!;
    const clueAlice: Action = { type: "clue", target: ALICE, clue: { kind: "rank", value: 2 } };
    // On turn 2 Alice tries to play the r1 she already played on turn 0.
    expect(() => replay({ config, deck, actions: [playR1, clueAlice, playR1] })).toThrow(
      /^Replay failed on turn 2: Illegal action: Card \d+ is not in your hand$/,
    );
  });
});
