import { describe, expect, it } from "vitest";
import { standardConfig } from "./config";
import { createGame, maxScore } from "./state";
import { orderedDeck } from "./deck";

const ALICE = 0;

describe("createGame", () => {
  it("deals five cards each with 2 or 3 players and four with 4 or 5", () => {
    for (const numPlayers of [2, 3, 4, 5] as const) {
      const config = standardConfig(numPlayers);
      const state = createGame(config, orderedDeck(config));
      const handSize = numPlayers <= 3 ? 5 : 4;
      expect(state.hands).toHaveLength(numPlayers);
      for (const hand of state.hands) expect(hand).toHaveLength(handSize);
      expect(state.drawPile).toHaveLength(50 - numPlayers * handSize);
    }
  });

  it("deals each seat its whole hand in turn, newest card first", () => {
    const config = standardConfig(2);
    const state = createGame(config, orderedDeck(config));
    expect(state.hands).toEqual([
      [4, 3, 2, 1, 0],
      [9, 8, 7, 6, 5],
    ]);
    expect(state.drawPile[0]).toBe(10);
    expect(state.drawPile.at(-1)).toBe(49);
  });

  it("starts with no clue knowledge and a frozen state", () => {
    const config = standardConfig(2);
    const state = createGame(config, orderedDeck(config));
    for (const card of state.cards) expect(card.clues).toEqual({ touchedBy: [], notTouchedBy: [] });
    expect(Object.isFrozen(state.hands[ALICE])).toBe(true);
  });

  it("starts with full clue tokens, no strikes and empty stacks", () => {
    const config = standardConfig(4);
    const state = createGame(config, orderedDeck(config));
    expect(state).toMatchObject({
      clueTokens: 8,
      strikes: 0,
      currentPlayer: ALICE,
      turnsRemaining: null,
      turn: 0,
      status: "playing",
      discardPile: [],
      stacks: { red: 0, yellow: 0, green: 0, blue: 0, purple: 0 },
    });
  });

  it("rejects a deck that does not match the config", () => {
    const config = standardConfig(2);
    const deck = orderedDeck(config);
    expect(() => createGame(config, deck.slice(1))).toThrow("Deck does not match");
    expect(() => createGame(config, [{ suit: "red", rank: 5 }, ...deck.slice(1)])).toThrow(
      "Deck does not match",
    );
  });
});

describe("maxScore", () => {
  it("is five per suit", () => {
    expect(maxScore(standardConfig(3))).toBe(25);
  });
});
