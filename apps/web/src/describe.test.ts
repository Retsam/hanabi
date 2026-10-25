import { history, playerView } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { chops, describeAction, describeEvent } from "./describe.ts";

const ALICE = 0;
const BOB = 1;

const game = deal({
  hands: [
    ["r1", "y2", "g3", "b4", "p5"],
    ["r2", "b2", "r3", "g1", "y1"],
  ],
});

describe("describeAction", () => {
  it("names the player's own cards by slot", () => {
    const view = playerView(game.state, ALICE);
    const action = { type: "discard", cardId: game.cardAt(2) } as const;
    expect(describeAction(ALICE, view, action)).toBe("You discard slot 3");
    expect(describeAction(BOB, view, action)).toBe("Alice discards slot 3");
  });

  it("names the slots a clue would touch", () => {
    const view = playerView(game.state, ALICE);
    const action = { type: "clue", target: BOB, clue: { kind: "color", value: "red" } } as const;
    expect(describeAction(ALICE, view, action)).toBe("You clue Bob red on slots 1, 3");
  });
});

describe("describeEvent", () => {
  it("says what happened, naming the human as You", () => {
    const after = game.clue(BOB, 2).play(0).discard(1);
    const moments = history(after.state);
    const lines = after.events.map((event, i) => describeEvent(BOB, event, moments[i]!));
    expect(lines).toEqual([
      "Alice clued You 2 on slots 1, 2",
      "You misplayed r2 (strike)",
      "Alice discarded y2 from slot 2",
    ]);
  });

  it("marks a discard that isn't the mover's chop", () => {
    const after = game.clue(BOB, 1).clue(ALICE, 5).discard(0).discard(2);
    const moments = history(after.state);
    const chopIds = chops(playerView(after.state, ALICE), 1);
    const lines = after.events.map((event, i) =>
      describeEvent(ALICE, event, moments[i]!, chopIds[i]),
    );
    expect(lines).toEqual([
      "You clued Bob 1 on slots 4, 5",
      "Bob clued You 5 on slot 5",
      "You discarded r1 from slot 1 (!)",
      "Bob discarded r3 from slot 3",
    ]);
  });
});
