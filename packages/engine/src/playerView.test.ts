import { describe, expect, it } from "vitest";
import { playerView } from "./playerView";
import { deal } from "./testing/scenario";

// Three players. Seat 0 clues seat 1's 1s (touching only y1), seat 1 discards y5, seat 2 plays g1.
const start = deal({
  players: 3,
  hands: [
    ["r1", "r2", "r3", "r4", "r5"],
    ["y1", "y2", "y3", "y4", "y5"],
    ["g1", "g2", "g3", "g4", "g5"],
  ],
  drawPile: ["b1", "b2", "b3"],
});
const [y1, y2, y5, g1] = [
  start.cardAt(0, 1),
  start.cardAt(1, 1),
  start.cardAt(4, 1),
  start.cardAt(0, 2),
];
const game = start.clue(1, 1).discard(4).play(0);
const { state } = game;

/** The card names `seat` sees for each card id, with "?" for hidden ones. */
const seen = (seat: number, ids: readonly number[]) =>
  ids.map((id) => {
    const card = playerView(state, seat).cards[id]?.card;
    return card ? game.name(id) : "?";
  });

describe("playerView", () => {
  it("hides the viewer's own cards and shows everyone else's", () => {
    expect(state.hands.map((hand) => seen(0, hand))).toEqual([
      ["?", "?", "?", "?", "?"],
      ["b1", "y1", "y2", "y3", "y4"],
      ["b2", "g2", "g3", "g4", "g5"],
    ]);
    expect(state.hands.map((hand) => seen(1, hand))).toEqual([
      ["r1", "r2", "r3", "r4", "r5"],
      ["?", "?", "?", "?", "?"],
      ["b2", "g2", "g3", "g4", "g5"],
    ]);
  });

  it("hides the draw pile and exposes only its size", () => {
    const view = playerView(state, 0);
    expect(view.drawPileSize).toBe(1);
    expect(view).not.toHaveProperty("drawPile");
    expect(seen(0, state.drawPile)).toEqual(["?"]);
  });

  it("shows discarded and played cards to everyone, including their old owner", () => {
    expect(seen(1, [y5])).toEqual(["y5"]);
    expect(seen(2, [g1])).toEqual(["g1"]);
  });

  it("shows clue knowledge on the viewer's own cards", () => {
    const view = playerView(state, 1);
    const rank1 = { kind: "rank", value: 1 };
    expect(view.cards[y1]).toMatchObject({ card: null, clues: { touchedBy: [rank1] } });
    expect(view.cards[y2]).toMatchObject({ card: null, clues: { notTouchedBy: [rank1] } });
  });

  it("keeps card ids aligned with the state's card table", () => {
    const view = playerView(state, 2);
    expect(view.cards).toHaveLength(state.cards.length);
    view.cards.forEach((card, i) => expect(card.id).toBe(i));
  });

  it("copies the public game state and records the viewer's seat", () => {
    const { cards: _, drawPile: __, ...publicState } = state;
    expect(playerView(state, 2)).toMatchObject({ ...publicState, seat: 2 });
  });

  it("rejects a seat that is not at the table", () => {
    expect(() => playerView(state, 3)).toThrow("not at the table");
    expect(() => playerView(state, -1)).toThrow("not at the table");
    expect(() => playerView(state, 0.5)).toThrow("not at the table");
  });
});
