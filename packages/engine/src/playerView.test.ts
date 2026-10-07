import { describe, expect, it } from "vitest";
import { playerView } from "./playerView";
import { deal } from "./testing/scenario";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;
const DONALD = 3;

// Three players. Alice clues Bob's 1s (touching only y1), Bob discards y5, Cathy plays g1.
const start = deal({
  hands: [
    ["r1", "r2", "r3", "r4", "r5"],
    ["y1", "y2", "y3", "y4", "y5"],
    ["g1", "g2", "g3", "g4", "g5"],
  ],
  drawPile: ["b1", "b2", "b3"],
});
const [y1, y2, y5, g1] = [
  start.cardAt(0, BOB),
  start.cardAt(1, BOB),
  start.cardAt(4, BOB),
  start.cardAt(0, CATHY),
];
const game = start.clue(BOB, 1).discard(4).play(0);
const { state } = game;

/** The card names `seat` sees for each card id, with "?" for hidden ones. */
const seen = (seat: number, ids: readonly number[]) =>
  ids.map((id) => {
    const card = playerView(state, seat).cards[id]?.card;
    return card ? game.name(id) : "?";
  });

describe("playerView", () => {
  it("hides the viewer's own cards and shows everyone else's", () => {
    expect(state.hands.map((hand) => seen(ALICE, hand))).toEqual([
      ["?", "?", "?", "?", "?"],
      ["b1", "y1", "y2", "y3", "y4"],
      ["b2", "g2", "g3", "g4", "g5"],
    ]);
    expect(state.hands.map((hand) => seen(BOB, hand))).toEqual([
      ["r1", "r2", "r3", "r4", "r5"],
      ["?", "?", "?", "?", "?"],
      ["b2", "g2", "g3", "g4", "g5"],
    ]);
  });

  it("hides the draw pile and exposes only its size", () => {
    const view = playerView(state, ALICE);
    expect(view.drawPileSize).toBe(1);
    expect(view).not.toHaveProperty("drawPile");
    expect(seen(ALICE, state.drawPile)).toEqual(["?"]);
  });

  it("shows discarded and played cards to everyone, including their old owner", () => {
    expect(seen(BOB, [y5])).toEqual(["y5"]);
    expect(seen(CATHY, [g1])).toEqual(["g1"]);
  });

  it("shows clue knowledge on the viewer's own cards", () => {
    const view = playerView(state, BOB);
    const rank1 = { kind: "rank", value: 1 };
    expect(view.cards[y1]).toMatchObject({ card: null, clues: { touchedBy: [rank1] } });
    expect(view.cards[y2]).toMatchObject({ card: null, clues: { notTouchedBy: [rank1] } });
  });

  it("carries the whole event log, the same for every seat", () => {
    expect(playerView(state, ALICE).log).toEqual(game.events);
    expect(playerView(state, BOB).log).toEqual(playerView(state, CATHY).log);
    expect(playerView(state, ALICE).log.map((event) => event.type)).toEqual([
      "clue",
      "discard",
      "play",
    ]);
  });

  it("keeps card ids aligned with the state's card table", () => {
    const view = playerView(state, CATHY);
    expect(view.cards).toHaveLength(state.cards.length);
    view.cards.forEach((card, i) => expect(card.id).toBe(i));
  });

  it("copies the public game state and records the viewer's seat", () => {
    const { cards: _, drawPile: __, ...publicState } = state;
    expect(playerView(state, CATHY)).toMatchObject({ ...publicState, seat: CATHY });
  });

  it("rejects a seat that is not at the table", () => {
    expect(() => playerView(state, DONALD)).toThrow("not at the table");
    expect(() => playerView(state, -1)).toThrow("not at the table");
    expect(() => playerView(state, 0.5)).toThrow("not at the table");
  });
});
