import { describe, expect, it } from "vitest";
import { apply, legalActions, validate } from "./actions";
import { score } from "./state";
import { deal } from "./testing/scenario";

// Two players. Seat 0 holds r1 r2 r3 r4 r5 (slot 1 first); seat 1 holds y1 y2 g1 b1 b2.
const start = () =>
  deal({
    hands: [
      ["r1", "r2", "r3", "r4", "r5"],
      ["y1", "y2", "g1", "b1", "b2"],
    ],
    drawPile: ["p1", "p2", "p3"],
  });

describe("scenario builder", () => {
  it("deals the hands and draw pile it was given", () => {
    const game = start();
    expect(game.hands).toEqual([
      ["r1", "r2", "r3", "r4", "r5"],
      ["y1", "y2", "g1", "b1", "b2"],
    ]);
    expect(game.state.drawPile.map((id) => game.name(id))).toEqual(["p1", "p2", "p3"]);
    expect(game.state.discardPile).toHaveLength(50 - 10 - 3);
  });
});

describe("play", () => {
  it("adds a playable card to its stack and draws to the front of the hand", () => {
    const game = start().play(0);
    expect(game.state.stacks.red).toBe(1);
    expect(game.hands[0]).toEqual(["p1", "r2", "r3", "r4", "r5"]);
    expect(game.state.strikes).toBe(0);
    expect(game.event).toMatchObject({
      type: "play",
      seat: 0,
      card: { suit: "red", rank: 1 },
      success: true,
      drawn: game.cardAt(0, 0),
    });
  });

  it("strikes and discards a card that is not playable", () => {
    const game = start().play(1);
    expect(game.state.stacks.red).toBe(0);
    expect(game.state.strikes).toBe(1);
    expect(game.state.discardPile.at(-1)).toBe(start().cardAt(1));
    expect(game.event).toMatchObject({ type: "play", success: false });
  });

  it("returns a clue token for a 5 below max", () => {
    const base = {
      hands: [
        ["r5", "r1", "r1", "r1", "y1"],
        ["y1", "y2", "g1", "b1", "b2"],
      ],
    };
    const game = deal({ ...base, stacks: { red: 4 }, clueTokens: 3 }).play(0);
    expect(game.state.stacks.red).toBe(5);
    expect(game.state.clueTokens).toBe(4);
    expect(deal({ ...base, stacks: { red: 4 } }).play(0).state.clueTokens).toBe(8);
  });

  it("ends the game on the third strike with a score of 0", () => {
    const game = deal({
      hands: [
        ["r1", "r3", "r4", "r2", "r5"],
        ["y1", "y2", "g1", "b1", "b2"],
      ],
      stacks: { blue: 1 },
      strikes: 2,
    }).play(1);
    expect(game.state.strikes).toBe(3);
    expect(game.state.status).toBe("over");
    expect(score(game.state)).toBe(0);
    expect(legalActions(game.state)).toEqual([]);
  });

  it("ends the game when every stack is complete", () => {
    const game = deal({
      hands: [
        ["p5", "r1", "r1", "r1", "y1"],
        ["y1", "y1", "g1", "g1", "b1"],
      ],
      stacks: { red: 5, yellow: 5, green: 5, blue: 5, purple: 4 },
    }).play(0);
    expect(score(game.state)).toBe(25);
    expect(game.state.status).toBe("over");
  });

  it("rejects a card that is not in the current player's hand", () => {
    const game = start();
    expect(validate(game.state, { type: "play", cardId: game.cardAt(0, 1) })).toMatch(
      "not in your hand",
    );
    expect(() => game.do({ type: "play", cardId: game.cardAt(0, 1) })).toThrow("Illegal action");
  });
});

describe("discard", () => {
  it("moves the card to the discard pile, gains a clue token and draws", () => {
    const game = start().clue(1, "yellow").discard(2);
    expect(game.state.clueTokens).toBe(8);
    expect(game.state.discardPile.at(-1)).toBe(start().cardAt(2, 1));
    expect(game.hands[1]).toEqual(["p1", "y1", "y2", "b1", "b2"]);
    expect(game.event).toMatchObject({
      type: "discard",
      seat: 1,
      card: { suit: "green", rank: 1 },
    });
  });

  it("is not allowed at max clue tokens", () => {
    const game = start();
    expect(validate(game.state, { type: "discard", cardId: game.cardAt(0) })).toMatch(
      "full clue tokens",
    );
  });
});

describe("clue", () => {
  it("spends a token and records positive and negative knowledge on every card in the hand", () => {
    const game = start().clue(1, 2);
    const twos = { kind: "rank", value: 2 };
    expect(game.state.clueTokens).toBe(7);
    expect(game.event).toEqual({
      type: "clue",
      seat: 0,
      target: 1,
      clue: twos,
      touched: [game.cardAt(1, 1), game.cardAt(4, 1)],
    });
    const knowledge = game.state.hands[1]!.map((id) => game.state.cards[id]!.clues);
    expect(knowledge).toEqual([
      { touchedBy: [], notTouchedBy: [twos] },
      { touchedBy: [twos], notTouchedBy: [] },
      { touchedBy: [], notTouchedBy: [twos] },
      { touchedBy: [], notTouchedBy: [twos] },
      { touchedBy: [twos], notTouchedBy: [] },
    ]);
    // Other hands are untouched, and the hand does not change.
    expect(game.state.cards[game.cardAt(0, 0)]!.clues.notTouchedBy).toEqual([]);
    expect(game.hands).toEqual(start().hands);
  });

  it("touches cards by color", () => {
    const game = start().clue(1, "blue");
    expect(game.event).toMatchObject({ touched: [game.cardAt(3, 1), game.cardAt(4, 1)] });
  });

  it("must touch at least one card", () => {
    expect(
      validate(start().state, { type: "clue", target: 1, clue: { kind: "color", value: "red" } }),
    ).toBe("A clue must touch at least one card");
  });

  it("needs a clue token", () => {
    const { state } = deal({ ...setupOf(), clueTokens: 0 });
    expect(validate(state, { type: "clue", target: 1, clue: { kind: "rank", value: 1 } })).toBe(
      "No clue tokens left",
    );
  });

  it("cannot target yourself, a missing seat or an unknown value", () => {
    const { state } = start();
    const rank1 = { kind: "rank", value: 1 } as const;
    expect(validate(state, { type: "clue", target: 0, clue: rank1 })).toBe("Cannot clue yourself");
    expect(validate(state, { type: "clue", target: 2, clue: rank1 })).toBe("There is no seat 2");
    expect(
      validate(state, { type: "clue", target: 1, clue: { kind: "color", value: "pink" } }),
    ).toBe("Unknown color pink");
  });
});

describe("turns and the final round", () => {
  it("passes the turn to the next seat", () => {
    const game = start().clue(1, 1);
    expect(game.state.currentPlayer).toBe(1);
    expect(game.state.turn).toBe(1);
    expect(game.clue(0, 1).state.currentPlayer).toBe(0);
  });

  it("gives every player one more turn after the last card is drawn", () => {
    let game = deal({ ...setupOf(), drawPile: ["p1"] }).play(0);
    expect(game.state.drawPile).toEqual([]);
    expect(game.state.status).toBe("finalRound");
    expect(game.state.turnsRemaining).toBe(2);
    expect(game.event).toMatchObject({ drawn: game.cardAt(0, 0) });

    // Plays with an empty draw pile draw nothing.
    game = game.play(2);
    expect(game.event).toMatchObject({ type: "play", drawn: null });
    expect(game.hands[1]).toHaveLength(4);
    expect(game.state.turnsRemaining).toBe(1);
    expect(game.state.status).toBe("finalRound");

    game = game.clue(1, "yellow");
    expect(game.state.turnsRemaining).toBe(0);
    expect(game.state.status).toBe("over");
    expect(validate(game.state, { type: "play", cardId: game.cardAt(0) })).toBe("The game is over");
    expect(score(game.state)).toBe(2);
  });
});

describe("legalActions", () => {
  it("lists plays, clues that touch something, and no discards at max clue tokens", () => {
    const actions = legalActions(start().state);
    expect(actions.filter((a) => a.type === "play")).toHaveLength(5);
    expect(actions.filter((a) => a.type === "discard")).toHaveLength(0);
    // Seat 1 has yellow, green and blue cards, and ranks 1 and 2.
    expect(actions.filter((a) => a.type === "clue").map((a) => a.clue.value)).toEqual([
      "yellow",
      "green",
      "blue",
      1,
      2,
    ]);
  });

  it("includes discards below max clue tokens and no clues at 0", () => {
    const actions = legalActions(deal({ ...setupOf(), clueTokens: 0 }).state);
    expect(actions.filter((a) => a.type === "discard")).toHaveLength(5);
    expect(actions.filter((a) => a.type === "clue")).toHaveLength(0);
  });

  it("only returns actions that validate and apply", () => {
    for (const game of [start(), start().clue(1, 1), deal({ ...setupOf(), clueTokens: 4 })]) {
      for (const action of legalActions(game.state)) {
        expect(validate(game.state, action)).toBeNull();
        expect(() => apply(game.state, action)).not.toThrow();
      }
    }
  });
});

describe("apply", () => {
  it("does not change the state it was given", () => {
    const before = start();
    const snapshot = structuredClone(before.state);
    before.play(0).clue(0, "red").discard(1);
    expect(before.state).toEqual(snapshot);
  });
});

describe("score", () => {
  it("sums the stacks", () => {
    expect(score(start().state)).toBe(0);
    expect(score(deal({ ...setupOf(), stacks: { red: 3, blue: 2 } }).state)).toBe(5);
  });
});

function setupOf() {
  return {
    hands: [
      ["r1", "r2", "r3", "r4", "r5"],
      ["y1", "y2", "g1", "b1", "b2"],
    ],
  };
}
