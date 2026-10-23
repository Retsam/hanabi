import { playerView } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { reviewGame, reviewMove } from "./review.ts";
import { forRandomGames } from "./testing/randomGames.ts";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

describe("reviewMove", () => {
  // beginner/finesse, first example: Alice's red clue on Cathy's r4 finesses Bob's r3.
  const finesse = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["r3", "g4", "b4", "p4", "y4"],
      ["g5", "b5", "r4", "p5", "y5"],
    ],
    stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
  }).clue(CATHY, "red");
  const view = playerView(finesse.state, BOB);

  it("ranks the best move first, with the runner-up as the alternative", () => {
    const review = reviewMove(view, { type: "play", cardId: finesse.cardAt(0, BOB) }, 1);
    expect(review).toMatchObject({
      turn: 1,
      seat: BOB,
      move: { category: "mandated", reasons: [{ convention: "finesse" }] },
      rank: 1,
    });
    expect(review.alternative?.action).not.toEqual(review.move.action);
  });

  it("flags a move that breaks a convention and names the top move as the alternative", () => {
    const review = reviewMove(view, { type: "discard", cardId: finesse.cardAt(0, BOB) }, 1);
    expect(review.move).toMatchObject({ category: "violates", reasons: [{ convention: "chop" }] });
    expect(review.rank).toBeGreaterThan(1);
    expect(review.alternative).toMatchObject({
      action: { type: "play", cardId: finesse.cardAt(0, BOB) },
      category: "mandated",
    });
  });

  it("gives moves tied on category and score the same rank", () => {
    // Both of Alice's clued 1s are known to be playable.
    const game = deal({
      hands: [
        ["r1*", "y1*", "g3", "b3", "p3"],
        ["r3", "y3", "g4", "b4", "p4"],
      ],
    });
    const second = reviewMove(
      playerView(game.state, ALICE),
      { type: "play", cardId: game.cardAt(1, ALICE) },
      1,
    );
    expect(second).toMatchObject({ move: { category: "permitted" }, rank: 1 });
    expect(second.alternative?.action).toEqual({ type: "play", cardId: game.cardAt(0, ALICE) });
  });

  it("matches a clue whatever order its fields are in", () => {
    const review = reviewMove(
      view,
      { clue: { value: 4, kind: "rank" }, target: CATHY, type: "clue" },
      1,
    );
    expect(review.move.action).toEqual({
      type: "clue",
      target: CATHY,
      clue: { kind: "rank", value: 4 },
    });
  });

  it("throws on a move the viewer can't make", () => {
    expect(() => reviewMove(view, { type: "play", cardId: finesse.cardAt(0, ALICE) }, 1)).toThrow(
      /Seat 1 can't make .* on turn 1/,
    );
  });
});

describe("reviewGame", { timeout: 60_000 }, () => {
  it("reviews every move of a game from its player's view", () => {
    // A review ranks every turn's moves, so this runs on few games.
    forRandomGames(200, (game) => {
      const reviews = reviewGame(game, 1);
      expect(reviews.map((review) => review.turn)).toEqual(game.actions.map((_, turn) => turn));
      for (const [turn, review] of reviews.entries()) {
        expect(review.seat).toBe(game.states[turn]!.currentPlayer);
        expect(review.move.action).toEqual(game.actions[turn]);
        expect(review.rank).toBeGreaterThanOrEqual(1);
        expect(review.rank).toBeLessThanOrEqual(review.moves);
      }
    });
  });
});
