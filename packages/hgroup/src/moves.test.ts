// Scenario tests for move ranking at level 1. The Save Principle and Minimum Clue Value examples are
// the H-Group beginner's guide's own. See docs/conventions/level-1.md.
import { type Action, legalActions, playerView, type Seat } from "@hanabi/engine";
import { deal, type Scenario } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { rankMoves } from "./moves.ts";
import { forRandomGames } from "./testing/randomGames.ts";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

const ranked = (game: Scenario, seat: Seat = game.state.currentPlayer) =>
  rankMoves(playerView(game.state, seat), 1);

const key = (action: Action) => JSON.stringify(action);

/** The judged move for `action`. */
const judged = (game: Scenario, action: Action) => {
  const move = ranked(game).find((each) => key(each.action) === key(action));
  if (move === undefined) throw new Error(`${JSON.stringify(action)} is not legal`);
  return move;
};

const conventions = (move: { reasons: readonly { convention: string | null }[] }) =>
  move.reasons.map((reason) => reason.convention);

describe("plays", () => {
  // beginner/finesse, first example: Alice's red clue on Cathy's r4 finesses Bob's r3.
  const finesse = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["r3", "g4", "b4", "p4", "y4"],
      ["g5", "b5", "r4", "p5", "y5"],
    ],
    stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
  }).clue(CATHY, "red");

  it("are mandated when a finesse is waiting on the card", () => {
    const [top] = ranked(finesse);
    expect(top).toMatchObject({
      action: { type: "play", cardId: finesse.cardAt(0, BOB) },
      category: "mandated",
    });
    expect(conventions(top!)).toEqual(["finesse"]);
  });

  it("are mandated when a prompt is waiting on the card", () => {
    const prompt = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g4", "b4", "r*3", "p4", "y4"],
        ["g5", "r4", "b5", "p5", "y5"],
      ],
      stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
    }).clue(CATHY, "red");
    expect(judged(prompt, { type: "play", cardId: prompt.cardAt(2, BOB) })).toMatchObject({
      category: "mandated",
      reasons: [{ convention: "prompt" }],
    });
  });

  // beginner/prompt, second example: with two red cards that could be the r3, Bob plays the leftmost.
  it("are mandated for the leftmost card a prompt could be on", () => {
    const prompt = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g4", "b4", "p4", "r*3", "r*5"],
        ["g5", "r4", "b5", "p5", "y5"],
      ],
      stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
    }).clue(CATHY, "red");
    const [top] = ranked(prompt);
    expect(top).toMatchObject({
      action: { type: "play", cardId: prompt.cardAt(3, BOB) },
      category: "mandated",
    });
    expect(judged(prompt, { type: "play", cardId: prompt.cardAt(4, BOB) }).category).toBe(
      "violates",
    );
  });

  it("wait for the known card under a prompted card to play first", () => {
    // Bob's known r1 plays first, so Alice's red clue on Cathy's r3 prompts his other red card as
    // the r2. It isn't playable until the r1 is.
    const prompt = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g4", "b4", "r*2", "p4", "r*1*"],
        ["g5", "r3", "b5", "p5", "y5"],
      ],
      clueTokens: 6,
    }).clue(CATHY, "red");
    const moves = ranked(prompt).filter((move) => move.action.type === "play");
    expect(moves[0]).toMatchObject({
      action: { cardId: prompt.cardAt(4, BOB) },
      category: "permitted",
    });
    expect(judged(prompt, { type: "play", cardId: prompt.cardAt(2, BOB) }).category).toBe(
      "violates",
    );
    // Once the r1 has played, the prompt is owed.
    const next = prompt.play(4).discard(4).discard(4);
    expect(ranked(next)[0]).toMatchObject({
      action: { type: "play", cardId: prompt.cardAt(2, BOB) },
      category: "mandated",
    });
  });

  // beginner/prompt, fourth example: Bob's three 3s play left to right until the r3 turns up.
  it("move on to the next candidate when the leftmost was another card", () => {
    const game = deal({
      hands: [
        ["y3", "g4", "b4", "p3", "y4"],
        ["g5", "b3*", "g3*", "r3*", "p4"],
        ["y5", "b5", "r4", "p5", "y4"],
      ],
      stacks: { red: 2, yellow: 1, green: 2, blue: 2, purple: 1 },
      clueTokens: 6,
    }).clue(CATHY, "red");
    expect(ranked(game)[0]).toMatchObject({
      action: { type: "play", cardId: game.cardAt(1, BOB) },
      category: "mandated",
    });
    // Bob's b3 plays and he draws, so his g3 moves to slot 3.
    const next = game.play(1).discard(4).discard(4);
    expect(ranked(next)[0]).toMatchObject({
      action: { type: "play", cardId: next.cardAt(2, BOB) },
      category: "mandated",
    });
  });

  it("aren't owed for a self-prompt while the clue may still be a direct play clue", () => {
    // Alice's red clue on Bob's r4 could be a play clue on the r3, or on the r4 through his r3.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["r4", "g4", "b4", "r*3", "p4"],
      ],
      stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
    }).clue(BOB, "red");
    expect(judged(game, { type: "play", cardId: game.cardAt(3, BOB) }).category).toBe("violates");
  });

  it("violate the conventions when the card is not known to be playable", () => {
    const move = judged(finesse, { type: "play", cardId: finesse.cardAt(1, BOB) });
    expect(move.category).toBe("violates");
    expect(conventions(move)).toEqual([null]);
  });

  it("are permitted for a card the player knows is playable", () => {
    const game = deal({
      hands: [
        ["y3", "g3", "r*1*", "p3", "y4"],
        ["r3", "g4", "b4", "p4", "y4"],
      ],
    });
    expect(judged(game, { type: "play", cardId: game.cardAt(2) })).toMatchObject({
      category: "permitted",
      score: 100,
    });
  });
});

describe("discards", () => {
  const setup = {
    hands: [
      ["g4", "b4", "r1*", "p4", "y4"],
      ["r2", "g3", "b3", "p3", "y3"],
      ["g4", "b4", "r4", "p3", "y3"],
    ],
    stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    clueTokens: 7,
  };

  it("prefer known trash to the chop", () => {
    const game = deal(setup);
    const trash = judged(game, { type: "discard", cardId: game.cardAt(2) });
    expect(trash).toMatchObject({ category: "permitted", reasons: [{ convention: "trash" }] });
  });

  // level-1#the-early-game: every play and save clue first.
  it("of the chop violate the Early Game while a play clue is still available", () => {
    const game = deal(setup);
    const discard = judged(game, { type: "discard", cardId: game.cardAt(4) });
    expect(discard).toMatchObject({
      category: "violates",
      reasons: [{ convention: "early-game" }],
    });
    expect(
      judged(game, { type: "clue", target: BOB, clue: { kind: "color", value: "red" } }),
    ).toMatchObject({ category: "permitted" });
  });

  it("of the chop are permitted once there are no play or save clues to give", () => {
    // Every suit needs its 2 next, and nobody holds one: no clue can get a card.
    const game = deal({
      ...setup,
      hands: [setup.hands[0]!, ["r3", "r4", "y3", "y4", "g3"], ["g4", "b3", "b4", "p3", "p4"]],
    });
    expect(
      ranked(game).filter((move) => move.action.type === "clue" && move.category !== "violates"),
    ).toEqual([]);
    expect(judged(game, { type: "discard", cardId: game.cardAt(4) })).toMatchObject({
      category: "permitted",
      reasons: [{ convention: "chop" }],
    });
  });

  it("of clued cards or cards off chop violate the conventions", () => {
    const game = deal({
      ...setup,
      hands: [["g4", "b4", "r*3", "p4", "y4"], ...setup.hands.slice(1)],
    });
    expect(judged(game, { type: "discard", cardId: game.cardAt(2) })).toMatchObject({
      category: "violates",
      reasons: [{ convention: "good-touch" }],
    });
    expect(judged(game, { type: "discard", cardId: game.cardAt(0) })).toMatchObject({
      category: "violates",
      reasons: [{ convention: "chop" }],
    });
  });
});

describe("clues", () => {
  const stacks = { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 };

  it("are permitted when the table reads them as the card they are on", () => {
    // beginner/finesse, first example, from Alice's side: Bob's r3 is on his finesse position.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["r3", "g4", "b4", "p4", "y4"],
        ["g5", "b5", "r4", "p5", "y5"],
      ],
      stacks,
    });
    const move = judged(game, {
      type: "clue",
      target: CATHY,
      clue: { kind: "color", value: "red" },
    });
    expect(move.category).toBe("permitted");
    expect(conventions(move)).toEqual(["finesse"]);
  });

  it("violate the conventions when they would be misread", () => {
    // The same clue with no r3 on Bob's finesse position: Cathy would play her r4 as the r3.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g4", "r3", "b4", "p4", "y4"],
        ["g5", "b5", "r4", "p5", "y5"],
      ],
      stacks,
    });
    const move = judged(game, {
      type: "clue",
      target: CATHY,
      clue: { kind: "color", value: "red" },
    });
    expect(move.category).toBe("violates");
    expect(move.reasons[0]!.text).toBe(
      "Cluing red to seat 2 would be read as the red 3, but the card is the red 4.",
    );
  });

  // beginner/minimum-clue-value-principle, the Tempo Clue: re-cluing Bob's 2-saved r2 gets no new card.
  it("violate Minimum Clue Value when they get no new card", () => {
    const game = deal({
      hands: [
        ["r5", "y5", "g5", "b5", "p5"],
        ["b3", "b4", "g4", "p4", "r2*"],
        ["y4", "g4", "p4", "b3", "b4"],
      ],
      stacks: { red: 1, yellow: 3, green: 3, blue: 0, purple: 3 },
    });
    const move = judged(game, { type: "clue", target: BOB, clue: { kind: "color", value: "red" } });
    expect(move.category).toBe("violates");
    expect(conventions(move)).toContain("minimum-clue-value");
  });

  // level-3#the-sarcastic-discard calls such a clue a mistake: it might break Good Touch.
  it("are a last resort when the card they get may be a copy of the cluer's own clued card", () => {
    // Alice's clued 1 could be the y1 she would clue in Bob's hand.
    const game = deal({
      hands: [
        ["r3", "g3", "b3", "p3", "r1*"],
        ["y1", "g4", "b4", "p4", "r4"],
        ["g4", "b4", "y4", "r4", "p4"],
      ],
    });
    const yellow = judged(game, {
      type: "clue",
      target: BOB,
      clue: { kind: "color", value: "yellow" },
    });
    expect(yellow.category).toBe("violates");
    expect(conventions(yellow)).toContain("good-touch");
  });

  it("still save a card that may be a copy of the cluer's own clued card", () => {
    // Alice's clued 2 could be the other y2, but the Save Principle comes first.
    const game = deal({
      hands: [
        ["r3", "g3", "b3", "p3", "r2*"],
        ["g4", "b4", "p4", "r4", "y2"],
        ["g4", "b4", "y4", "r4", "p4"],
      ],
    });
    const two = judged(game, { type: "clue", target: BOB, clue: { kind: "rank", value: 2 } });
    expect(two.category).toBe("mandated");
    expect(conventions(two)).toContain("good-touch");
  });

  // level-1#the-visible-rule
  it("can't 2 Save a 2 whose other copy is visible in another hand", () => {
    const game = deal({
      hands: [
        ["r3", "g3", "b3", "p3", "r4"],
        ["g4", "b4", "p4", "r4", "y2"],
        ["y2", "g5", "b5", "p5", "y5"],
      ],
    });
    const move = judged(game, { type: "clue", target: BOB, clue: { kind: "rank", value: 2 } });
    expect(move.category).toBe("violates");
    expect(conventions(move)).toContain("2-save");
  });

  // beginner/save-principle: the last b3 is on Bob's chop. Both saves break Good Touch, and blue
  // is better since one of the blue 4s is useful.
  it("that save a critical card from the next player's chop are mandated", () => {
    const game = deal({
      hands: [
        ["p1", "p1", "p1", "y1", "y1"],
        ["b4", "r3", "g1", "b4", "b3"],
      ],
      stacks: { red: 3, green: 2, blue: 1 },
      discardPile: ["b3"],
    });
    const [blue, three] = ranked(game);
    expect(blue).toMatchObject({
      action: { type: "clue", target: BOB, clue: { kind: "color", value: "blue" } },
      category: "mandated",
    });
    expect(three).toMatchObject({
      action: { type: "clue", target: BOB, clue: { kind: "rank", value: 3 } },
      category: "mandated",
    });
    expect(conventions(blue!)).toEqual(["critical-save", "good-touch", "save-principle"]);
    expect(blue!.score).toBeGreaterThan(three!.score);
  });

  it("that save a 5 from chop are only urgent for the next player", () => {
    const game = deal({
      hands: [
        ["r3", "g3", "b3", "p3", "r4"],
        ["g4", "b4", "p4", "r4", "y5"],
        ["g4", "b4", "p4", "y4", "b5"],
      ],
    });
    const five = { kind: "rank", value: 5 } as const;
    expect(judged(game, { type: "clue", target: BOB, clue: five }).category).toBe("mandated");
    expect(judged(game, { type: "clue", target: CATHY, clue: five }).category).toBe("permitted");
  });

  it("that save a card from chop are not urgent while the next player has a known play", () => {
    // Bob's clued 1 is playable: he plays it before he would discard his y5.
    const game = deal({
      hands: [
        ["r3", "g3", "b3", "p3", "r4"],
        ["g1*", "b4", "p4", "r4", "y5"],
        ["g4", "b4", "p4", "y4", "b5"],
      ],
    });
    const five = { kind: "rank", value: 5 } as const;
    expect(judged(game, { type: "clue", target: BOB, clue: five }).category).toBe("permitted");
  });

  it("that save a card from chop are not urgent while the next player owes a prompt", () => {
    // Donald's red clue on Cathy's r3 prompts Bob's red card: he plays it before he would discard
    // his y5.
    const game = deal({
      hands: [
        ["p4", "g4", "b3", "y1"],
        ["b4", "r*2", "y5", "g1"],
        ["g4", "r3", "b4", "b1"],
        ["p3", "p2", "y3", "y4"],
      ],
      drawPile: ["g3", "b2", "y2"],
      stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
      clueTokens: 5,
    })
      .discard(3)
      .discard(3)
      .discard(3)
      .clue(CATHY, "red");
    expect(game.state.currentPlayer).toBe(ALICE);
    const five = { kind: "rank", value: 5 } as const;
    expect(judged(game, { type: "clue", target: BOB, clue: five }).category).toBe("permitted");
  });

  // beginner/other-general-strategy, "Give Play Clues Over Save Clues": a play clue keeps Bob busy,
  // so his y5 needn't be saved yet.
  it("that give the next player a card to play are preferred to saving their chop", () => {
    const game = deal({
      hands: [
        ["r3", "b2", "p2", "y3", "g2"],
        ["g1", "b3", "g4", "p4", "y5"],
        ["r4", "b4", "p3", "y4", "g3"],
      ],
    });
    const one = judged(game, { type: "clue", target: BOB, clue: { kind: "rank", value: 1 } });
    const five = judged(game, { type: "clue", target: BOB, clue: { kind: "rank", value: 5 } });
    expect(one.category).toBe("mandated");
    expect(conventions(one)).toEqual(["play-clue", "save-principle"]);
    expect(five.category).toBe("mandated");
    expect(one.score).toBeGreaterThan(five.score);
    // A delayed play clue leaves Bob nothing to play now, so it doesn't stand in for the save.
    const four = judged(game, { type: "clue", target: BOB, clue: { kind: "rank", value: 4 } });
    expect(four.category).not.toBe("mandated");
  });

  it("that make the next player blind-play also stand in for saving their chop", () => {
    // Alice's red clue on Cathy's r2 finesses Bob's r1.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["r1", "g4", "b4", "p4", "y5"],
        ["g5", "b5", "r2", "p5", "y4"],
      ],
    });
    const red = judged(game, {
      type: "clue",
      target: CATHY,
      clue: { kind: "color", value: "red" },
    });
    expect(red.category).toBe("mandated");
    expect(conventions(red)).toEqual(["finesse", "save-principle"]);
  });
});

describe("rankMoves", () => {
  it("returns nothing once the game is over", () => {
    const game = deal({
      hands: [
        ["r3", "g3", "b3", "p3", "r4"],
        ["g4", "b4", "p4", "r4", "y5"],
      ],
      strikes: 2,
    }).play(0);
    expect(game.state.status).toBe("over");
    expect(ranked(game, ALICE)).toEqual([]);
  });

  it("judges every legal move once, best category first", () => {
    const order = ["mandated", "permitted", "violates"];
    forRandomGames(20, ({ state }) => {
      const moves = rankMoves(playerView(state, state.currentPlayer), 1);
      expect(moves.map((move) => key(move.action)).toSorted()).toEqual(
        legalActions(state).map(key).toSorted(),
      );
      const categories = moves.map((move) => order.indexOf(move.category));
      expect(categories).toEqual(categories.toSorted((a, b) => a - b));
    });
  });
});
