import { describe, expect, it } from "vitest";
import { standardConfig } from "./config";
import { orderedDeck } from "./deck";
import { playerView } from "./playerView";
import { createGame, type GameState } from "./state";

const config = standardConfig(3);
const deck = orderedDeck(config);
const initial = createGame(config, deck);

// A mid-game state built directly: seat 0 has a clued card, and one card has been discarded.
const redClue = { kind: "color", value: "red" } as const;
const state: GameState = {
  ...initial,
  cards: initial.cards.map((card) =>
    card.id === 0
      ? { ...card, clues: { touchedBy: [redClue], notTouchedBy: [] } }
      : card.id === 5
        ? { ...card, clues: { touchedBy: [], notTouchedBy: [redClue] } }
        : card,
  ),
  hands: [[15, 4, 3, 2, 1], initial.hands[1] ?? [], initial.hands[2] ?? []],
  drawPile: initial.drawPile.slice(1),
  discardPile: [0],
  clueTokens: 7,
  currentPlayer: 1,
  turn: 1,
};

describe("playerView", () => {
  it("hides the viewer's own cards", () => {
    const view = playerView(state, 0);
    for (const id of [15, 4, 3, 2, 1]) expect(view.cards[id]?.card).toBeNull();
  });

  it("shows other players' cards", () => {
    const view = playerView(state, 0);
    for (const id of [...(state.hands[1] ?? []), ...(state.hands[2] ?? [])]) {
      expect(view.cards[id]?.card).toEqual(deck[id]);
    }
  });

  it("hides the draw pile and exposes only its size", () => {
    const view = playerView(state, 1);
    expect(view.drawPileSize).toBe(state.drawPile.length);
    expect(view).not.toHaveProperty("drawPile");
    for (const id of state.drawPile) expect(view.cards[id]?.card).toBeNull();
  });

  it("shows discarded cards to everyone", () => {
    for (const seat of [0, 1, 2]) {
      expect(playerView(state, seat).cards[0]?.card).toEqual(deck[0]);
    }
  });

  it("shows clue knowledge for every card, including the viewer's own", () => {
    const view = playerView(state, 1);
    expect(view.cards[0]?.clues.touchedBy).toEqual([redClue]);
    // Card 5 is in seat 1's own hand.
    expect(view.cards[5]?.card).toBeNull();
    expect(view.cards[5]?.clues.notTouchedBy).toEqual([redClue]);
  });

  it("keeps card ids aligned with the state's card table", () => {
    const view = playerView(state, 2);
    expect(view.cards).toHaveLength(state.cards.length);
    view.cards.forEach((card, i) => expect(card.id).toBe(i));
  });

  it("copies the public game state and records the viewer's seat", () => {
    const view = playerView(state, 2);
    expect(view).toMatchObject({
      seat: 2,
      config,
      hands: state.hands,
      discardPile: [0],
      stacks: state.stacks,
      clueTokens: 7,
      strikes: 0,
      currentPlayer: 1,
      turnsRemaining: null,
      turn: 1,
      status: "playing",
    });
  });

  it("does not modify the state", () => {
    const before = structuredClone(state);
    playerView(state, 0);
    expect(state).toEqual(before);
  });

  it("rejects a seat that is not at the table", () => {
    expect(() => playerView(state, 3)).toThrow("not at the table");
    expect(() => playerView(state, -1)).toThrow("not at the table");
    expect(() => playerView(state, 0.5)).toThrow("not at the table");
  });
});
