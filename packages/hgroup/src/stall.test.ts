// Scenario tests for the 5 Stall (level 2). The site gives no worked example, so these follow its
// description. See docs/conventions/level-2.md.
import { type Action, playerView } from "@hanabi/engine";
import { deal, type Scenario } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { focusCards } from "./knowledge.ts";
import { rankMoves } from "./moves.ts";
import { names, read } from "./testing/knowledge.ts";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

/** The latest clue's reading from `seat`'s view at `level`. */
const lastReading = (game: Scenario, seat: number, level: number) =>
  read(game, seat, level).readings.at(-1)!;

const key = (action: Action) => JSON.stringify(action);

/** The judged move for `action`, at level 2. */
const judged = (game: Scenario, action: Action) =>
  rankMoves(playerView(game.state, game.state.currentPlayer), 2).find(
    (move) => key(move.action) === key(action),
  )!;

// Nothing has played and nobody holds a 1, so there is no play clue to give, and no 2 or critical
// card is on a chop. Bob's b5 is off chop, on slot 2.
const hands = [
  ["y4", "g4", "b4", "p4", "r4"],
  ["g3", "b5", "y4", "p4", "r3"],
  ["r2", "y3", "b3", "p3", "g4"],
];
const fiveToBob = { type: "clue", target: BOB, clue: { kind: "rank", value: 5 } } as const;

describe("the 5 Stall", () => {
  const stall = deal({ hands, clueTokens: 7 }).clue(BOB, 5);
  const bobsFive = stall.cardAt(1, BOB);

  it("reads a 5 clue on an off-chop 5 in the Early Game as a stall that saves the 5", () => {
    const reading = lastReading(stall, BOB, 2);
    expect(reading.focus).toBe(bobsFive);
    expect(reading.conventions).toEqual(["clue-focus", "save-clue", "5-stall"]);
    expect(names(focusCards(reading, "save"))).toEqual(["r5", "y5", "g5", "b5", "p5"]);
    expect(focusCards(reading, "play")).toEqual([]);
    expect(names(read(stall, BOB, 2).common[bobsFive]!)).toEqual(["r5", "y5", "g5", "b5", "p5"]);
  });

  it("is a level 2 convention", () => {
    expect(lastReading(stall, BOB, 1).conventions).not.toContain("5-stall");
  });

  it("is not read once someone has discarded", () => {
    // Alice and Bob discard their chops, ending the Early Game, then Cathy clues Bob's b5 (now on
    // slot 3). It is a play clue on a 5 again: no 5 is playable, so it could only be a Quadruple
    // Finesse on Alice (`multi-finesse`).
    const midGame = deal({ hands, clueTokens: 6 }).discard(4).discard(4).clue(BOB, 5);
    const reading = lastReading(midGame, CATHY, 2);
    expect(reading.focus).toBe(bobsFive);
    expect(reading.conventions).not.toContain("5-stall");
    expect(focusCards(reading, "save")).toEqual([]);
    expect(reading.interpretations.every((i) => i.connections.length === 4)).toBe(true);
  });

  it("is a permitted clue that doesn't hold off the end of the Early Game", () => {
    const game = deal({ hands, clueTokens: 7 });
    expect(judged(game, fiveToBob)).toMatchObject({
      category: "permitted",
      score: 5,
      reasons: [
        { convention: "5-stall", text: "Cluing number 5 to seat 1 is a 5 Stall on the blue 5." },
      ],
    });
    // A 5 Stall is not a play or save clue, so Alice may discard her chop instead.
    expect(judged(game, { type: "discard", cardId: game.cardAt(4, ALICE) })).toMatchObject({
      category: "permitted",
      reasons: [{ convention: "chop" }],
    });
  });

  it("ranks below a play clue", () => {
    const game = deal({
      hands: [hands[0]!, hands[1]!, ["r1", "y3", "b3", "p3", "g4"]],
      clueTokens: 7,
    });
    const playClue = judged(game, {
      type: "clue",
      target: CATHY,
      clue: { kind: "color", value: "red" },
    });
    expect(playClue.category).toBe("permitted");
    expect(judged(game, fiveToBob).score).toBeLessThan(playClue.score);
  });
});
