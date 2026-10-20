import { type Card, playerView, standardConfig } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { cluePossibilities, identities, possibilities } from "./possibilities.ts";
import { forRandomGames } from "./testing/randomGames.ts";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

/** Card names ("r4") for a list of identities, to keep expectations short. */
const names = (cards: readonly Card[]) => cards.map((card) => `${card.suit[0]}${card.rank}`);

describe("cluePossibilities", () => {
  const config = standardConfig(3);
  const red = { kind: "color", value: "red" } as const;
  const four = { kind: "rank", value: 4 } as const;
  const one = { kind: "rank", value: 1 } as const;

  it("allows every identity for an unclued card", () => {
    expect(cluePossibilities(config, { touchedBy: [], notTouchedBy: [] })).toEqual(
      identities(config),
    );
  });

  it("keeps the identities that match every touching clue", () => {
    expect(names(cluePossibilities(config, { touchedBy: [red, four], notTouchedBy: [] }))).toEqual([
      "r4",
    ]);
  });

  it("removes the identities a clue would have touched", () => {
    const clues = { touchedBy: [red], notTouchedBy: [one, four] };
    expect(names(cluePossibilities(config, clues))).toEqual(["r2", "r3", "r5"]);
  });
});

describe("possibilities", () => {
  it("knows every card it can see exactly", () => {
    const game = deal({
      hands: [
        ["r1", "r2", "r3", "r4", "r5"],
        ["y1", "y2", "y3", "y4", "y5"],
        ["g1", "g2", "g3", "g4", "g5"],
      ],
    });
    const view = playerView(game.state, ALICE);
    const result = possibilities(view);
    for (const id of [...game.state.hands[BOB]!, ...game.state.hands[CATHY]!]) {
      expect(result[id]).toEqual([view.cards[id]!.card]);
    }
  });

  it("rules out identities whose every copy is visible", () => {
    // Alice clues Bob's 5. Bob sees the yellow, green and blue 5s, so his is red or purple.
    const game = deal({
      hands: [
        ["y5", "g5", "b5", "r1", "r2"],
        ["p5", "y1", "y2", "y3", "b1"],
        ["g1", "g2", "g3", "b2", "b3"],
      ],
    }).clue(BOB, 5);
    const five = game.cardAt(0, BOB);
    expect(names(possibilities(playerView(game.state, BOB))[five]!)).toEqual(["r5", "p5"]);
    // Only Bob's own deduction uses what he sees; the clue alone allows any 5.
    expect(
      names(cluePossibilities(game.state.config, playerView(game.state, BOB).cards[five]!.clues)),
    ).toEqual(["r5", "y5", "g5", "b5", "p5"]);
  });

  it("counts a card it has deduced against the viewer's other cards", () => {
    // Alice clues Bob's red 4. Bob discards and draws the yellow 4, then Cathy clues both 4s.
    // Bob knows his old card is the red 4, and Alice holds the other, so his new 4 is not red.
    const game = deal({
      hands: [
        ["r4", "g1", "g2", "g3", "b1"],
        ["r4", "y1", "y2", "y3", "b2"],
        ["p1", "p2", "p3", "g5", "b3"],
      ],
      drawPile: ["y4", "g4", "b4", "p4"],
    })
      .clue(BOB, "red")
      .discard(4)
      .clue(BOB, 4);
    const result = possibilities(playerView(game.state, BOB));
    expect(names(result[game.cardAt(1, BOB)]!)).toEqual(["r4"]);
    expect(names(result[game.cardAt(0, BOB)]!)).toEqual(["y4", "g4", "b4", "p4"]);
  });

  it("does not rule out an identity with a copy still unseen", () => {
    // Bob's 4 is touched only by the 4 clue. Alice holds one red 4; the other is unseen.
    const game = deal({
      hands: [
        ["r4", "g1", "g2", "g3", "b1"],
        ["r4", "y1", "y2", "y3", "b2"],
        ["p1", "p2", "p3", "g5", "b3"],
      ],
    }).clue(BOB, 4);
    expect(names(possibilities(playerView(game.state, BOB))[game.cardAt(0, BOB)]!)).toEqual([
      "r4",
      "y4",
      "g4",
      "b4",
      "p4",
    ]);
  });
});

describe("possibilities over random games", { timeout: 60_000 }, () => {
  it("always include every card's real identity, for the player to move on every turn", () => {
    forRandomGames(4, ({ states }) => {
      const failures: string[] = [];
      for (const state of states) {
        const result = possibilities(playerView(state, state.currentPlayer));
        for (const { id, card } of state.cards) {
          const isCard = (possible: Card) =>
            possible.suit === card.suit && possible.rank === card.rank;
          if (!result[id]!.some(isCard)) failures.push(`turn ${state.turn}: card ${id}`);
        }
      }
      expect(failures).toEqual([]);
    });
  });
});
