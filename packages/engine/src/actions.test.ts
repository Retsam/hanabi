import { describe, expect, it } from "vitest";
import { type Action, apply, legalActions, validate } from "./actions";
import { score } from "./state";
import { deal } from "./testing/scenario";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

// Two players. Alice holds r1 r2 r3 r4 r5 (slot 1 first); Bob holds y1 y2 g1 b1 b2.
const start = () =>
  deal({
    hands: [
      ["r1", "r2", "r3", "r4", "r5"],
      ["y1", "y2", "g1", "b1", "b2"],
    ],
    drawPile: ["p1", "p2", "p3"],
  });

describe("play", () => {
  it("adds a playable card to its stack and draws to the front of the hand", () => {
    const game = start().play(0);
    expect(game.state.stacks.red).toBe(1);
    expect(game.hands[ALICE]).toEqual(["p1", "r2", "r3", "r4", "r5"]);
    expect(game.state.strikes).toBe(0);
    expect(game.event).toMatchObject({
      type: "play",
      seat: ALICE,
      card: { suit: "red", rank: 1 },
      success: true,
      drawn: game.cardAt(0, ALICE),
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
        ["r5", "g1", "g1", "g1", "y1"],
        ["y1", "y2", "r1", "b1", "b2"],
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
        ["p5", "r1", "r1", "y1", "g1"],
        ["y1", "g1", "b1", "b1", "p1"],
      ],
      stacks: { red: 5, yellow: 5, green: 5, blue: 5, purple: 4 },
    }).play(0);
    expect(score(game.state)).toBe(25);
    expect(game.state.status).toBe("over");
  });

  it("rejects a card that is not in the current player's hand", () => {
    const game = start();
    expect(validate(game.state, { type: "play", cardId: game.cardAt(0, BOB) })).toMatch(
      "not in your hand",
    );
    expect(() => game.do({ type: "play", cardId: game.cardAt(0, BOB) })).toThrow("Illegal action");
  });
});

describe("discard", () => {
  it("moves the card to the discard pile, gains a clue token and draws", () => {
    const game = start().clue(BOB, "yellow").discard(2);
    expect(game.state.clueTokens).toBe(8);
    expect(game.state.discardPile.at(-1)).toBe(start().cardAt(2, BOB));
    expect(game.hands[BOB]).toEqual(["p1", "y1", "y2", "b1", "b2"]);
    expect(game.event).toMatchObject({
      type: "discard",
      seat: BOB,
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
    const game = start().clue(BOB, 2);
    const twos = { kind: "rank", value: 2 };
    expect(game.state.clueTokens).toBe(7);
    expect(game.event).toEqual({
      type: "clue",
      seat: ALICE,
      target: BOB,
      clue: twos,
      touched: [game.cardAt(1, BOB), game.cardAt(4, BOB)],
    });
    const knowledge = game.state.hands[BOB]!.map((id) => game.state.cards[id]!.clues);
    expect(knowledge).toEqual([
      { touchedBy: [], notTouchedBy: [twos] },
      { touchedBy: [twos], notTouchedBy: [] },
      { touchedBy: [], notTouchedBy: [twos] },
      { touchedBy: [], notTouchedBy: [twos] },
      { touchedBy: [twos], notTouchedBy: [] },
    ]);
    // Other hands are untouched, and the hand does not change.
    expect(game.state.cards[game.cardAt(0, ALICE)]!.clues.notTouchedBy).toEqual([]);
    expect(game.hands).toEqual(start().hands);
  });

  it("touches cards by color", () => {
    const game = start().clue(BOB, "blue");
    expect(game.event).toMatchObject({ touched: [game.cardAt(3, BOB), game.cardAt(4, BOB)] });
  });

  it("must touch at least one card", () => {
    expect(
      validate(start().state, { type: "clue", target: BOB, clue: { kind: "color", value: "red" } }),
    ).toBe("A clue must touch at least one card");
  });

  it("needs a clue token", () => {
    const { state } = deal({ ...setupOf(), clueTokens: 0 });
    expect(validate(state, { type: "clue", target: BOB, clue: { kind: "rank", value: 1 } })).toBe(
      "No clue tokens left",
    );
  });

  it("cannot target yourself, a missing seat or an unknown value", () => {
    const { state } = start();
    const rank1 = { kind: "rank", value: 1 } as const;
    expect(validate(state, { type: "clue", target: ALICE, clue: rank1 })).toBe(
      "Cannot clue yourself",
    );
    expect(validate(state, { type: "clue", target: CATHY, clue: rank1 })).toBe(
      "There is no seat 2",
    );
    expect(
      validate(state, { type: "clue", target: BOB, clue: { kind: "color", value: "pink" } }),
    ).toBe("Unknown color pink");
  });
});

describe("turns and the final round", () => {
  it("passes the turn to the next seat", () => {
    const game = start().clue(BOB, 1);
    expect(game.state.currentPlayer).toBe(BOB);
    expect(game.state.turn).toBe(1);
    expect(game.clue(ALICE, 1).state.currentPlayer).toBe(ALICE);
  });

  it("gives every player one more turn after the last card is drawn", () => {
    let game = deal({ ...setupOf(), drawPile: ["p1"] }).play(0);
    expect(game.state.drawPile).toEqual([]);
    expect(game.state.status).toBe("finalRound");
    expect(game.state.turnsRemaining).toBe(2);
    expect(game.event).toMatchObject({ drawn: game.cardAt(0, ALICE) });

    // Plays with an empty draw pile draw nothing.
    game = game.play(2);
    expect(game.event).toMatchObject({ type: "play", drawn: null });
    expect(game.hands[BOB]).toHaveLength(4);
    expect(game.state.turnsRemaining).toBe(1);
    expect(game.state.status).toBe("finalRound");

    game = game.clue(BOB, "yellow");
    expect(game.state.turnsRemaining).toBe(0);
    expect(game.state.status).toBe("over");
    expect(validate(game.state, { type: "play", cardId: game.cardAt(0) })).toBe("The game is over");
    expect(score(game.state)).toBe(2);
  });

  it("starts the final round at once when nothing is left to draw", () => {
    const game = deal({ ...setupOf(), drawPile: [] });
    expect(game.state).toMatchObject({ status: "finalRound", turnsRemaining: 2 });
    expect(game.clue(BOB, 1).clue(ALICE, 1).state.status).toBe("over");
  });
});

describe("legalActions", () => {
  it("lists plays, clues that touch something, and no discards at max clue tokens", () => {
    const actions = legalActions(start().state);
    expect(actions.filter((a) => a.type === "play")).toHaveLength(5);
    expect(actions.filter((a) => a.type === "discard")).toHaveLength(0);
    // Bob has yellow, green and blue cards, and ranks 1 and 2.
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
});

describe("malformed actions", () => {
  // As they could arrive in a replay loaded from JSON.
  it("rejects an unknown action type or clue kind", () => {
    const { state } = start();
    const unknownType: Action = JSON.parse('{ "type": "pass" }');
    expect(validate(state, unknownType)).toBe("Unknown action type pass");
    expect(() => apply(state, unknownType)).toThrow("Illegal action");
    const unknownKind: Action = JSON.parse(
      `{ "type": "clue", "target": ${BOB}, "clue": { "kind": "suit", "value": 1 } }`,
    );
    expect(validate(state, unknownKind)).toBe("Unknown suit 1");
  });
});

describe("apply", () => {
  it("does not change the state it was given", () => {
    const before = start();
    const snapshot = structuredClone(before.state);
    before.play(0).clue(ALICE, "red").discard(1);
    expect(before.state).toEqual(snapshot);
  });

  it("appends the event it returns to the log", () => {
    const first = start().clue(BOB, 1);
    const { state, event } = apply(first.state, { type: "play", cardId: first.cardAt(0, BOB) });
    expect(state.log).toEqual([first.event, event]);
    expect(state.log[0]).toMatchObject({ type: "clue", seat: ALICE, target: BOB });
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
