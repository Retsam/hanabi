import {
  type Action,
  playerView,
  type Replay,
  replay,
  shuffledDeck,
  standardConfig,
} from "@hanabi/engine";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { describe, expect, it } from "vitest";
import { pastView, step } from "./lookback.ts";

const ALICE = 0;
const BOB = 1;

/** Alice clues Bob the rank of his first card, then Bob discards his last card. */
function game(): { record: Replay; discarded: number } {
  const config = standardConfig(3);
  const deck = shuffledDeck(config, xoroshiro128plus(7));
  const opening = replay({ config, deck, actions: [] }).state;
  const bobs = opening.hands[BOB]!;
  const clue: Action = {
    type: "clue",
    target: BOB,
    clue: { kind: "rank", value: opening.cards[bobs[0]!]!.card.rank },
  };
  const discarded = bobs.at(-1)!;
  return {
    record: { config, deck, actions: [clue, { type: "discard", cardId: discarded }] },
    discarded,
  };
}

describe("pastView", () => {
  it("shows the opening deal at 0 moves", () => {
    const view = pastView(game().record, BOB, 0);
    expect(view.log).toEqual([]);
    expect(view.clueTokens).toBe(8);
    expect(view.currentPlayer).toBe(ALICE);
  });

  it("shows the table after a move as the seat saw it then", () => {
    const { record, discarded } = game();
    const view = pastView(record, BOB, 1);
    expect(view.log).toHaveLength(1);
    expect(view.clueTokens).toBe(7);
    expect(view.currentPlayer).toBe(BOB);
    // Bob's discard is face up now, but was still a hidden card in his hand then.
    expect(view.hands[BOB]).toContain(discarded);
    expect(view.cards[discarded]!.card).toBeNull();
    expect(pastView(record, BOB, 2).cards[discarded]!.card).not.toBeNull();
  });

  it("matches the live view after every move", () => {
    const { record } = game();
    expect(pastView(record, BOB, 2)).toEqual(playerView(replay(record).state, BOB));
  });
});

describe("step", () => {
  it("steps back from the live table to the table before the last move", () => {
    expect(step(null, 5, -1)).toBe(4);
    expect(step(4, 5, -1)).toBe(3);
  });

  it("stops at the opening deal", () => {
    expect(step(0, 5, -1)).toBe(0);
    expect(step(null, 0, -1)).toBeNull();
  });

  it("returns to the live table after the last move", () => {
    expect(step(4, 5, 1)).toBeNull();
    expect(step(null, 5, 1)).toBeNull();
    expect(step(2, 5, 1)).toBe(3);
  });
});
