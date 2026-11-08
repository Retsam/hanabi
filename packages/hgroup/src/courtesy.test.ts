// Scenario tests for level 2's ranking conventions: Stomping on a Finesse (a violation) and keeping
// One-Away-From-Playable cards (a tiebreak between clues). See docs/conventions/level-2.md.
import { type Action, playerView, type Seat, type Suit } from "@hanabi/engine";
import { deal, type Scenario } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { rankMoves } from "./moves.ts";

const BOB = 1;
const CATHY = 2;
const DONALD = 3;

const key = (action: Action) => JSON.stringify(action);

/** The judged move for `action`, by whoever is to play, at `level`. */
const judged = (game: Scenario, action: Action, level = 2) => {
  const ranked = rankMoves(playerView(game.state, game.state.currentPlayer), level);
  const move = ranked.find((each) => key(each.action) === key(action));
  if (move === undefined) throw new Error(`${key(action)} is not legal`);
  return move;
};
const colorClue = (target: Seat, value: Suit): Action => ({
  type: "clue",
  target,
  clue: { kind: "color", value },
});
const conventions = (move: { reasons: readonly { convention: string | null }[] }) =>
  move.reasons.map((reason) => reason.convention);

describe("stomping on a finesse", () => {
  // level-2#stomping-on-a-finesse: Alice's red clue on Donald's r3 finesses Cathy's r2. Bob, who
  // sees the r2 on Cathy's finesse position, mustn't clue it directly: that wastes the clue.
  const finessed = deal({
    hands: [
      ["y3", "g3", "b3", "p3"],
      ["g4", "b4", "p4", "y4"],
      ["r2", "g2", "b5", "y5"],
      ["r3", "g5", "p5", "y2"],
    ],
    stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
  }).clue(DONALD, "red");

  it("is a violation", () => {
    const stomp = judged(finessed, colorClue(CATHY, "red"));
    expect(stomp.category).toBe("violates");
    expect(conventions(stomp)).toContain("stomping");
  });

  it("isn't judged at level 1", () => {
    expect(conventions(judged(finessed, colorClue(CATHY, "red"), 1))).not.toContain("stomping");
  });

  it("doesn't cover a card the finesse isn't on", () => {
    expect(conventions(judged(finessed, colorClue(CATHY, "green")))).not.toContain("stomping");
  });
});

describe("one-away-from-playable cards", () => {
  // level-2#one-away-from-playable-cards: an unclued card one card short of playable is worth
  // keeping, though it can't be clued. Between otherwise equal clues, prefer one that keeps it.
  it("favor a clue that gets the missing card played", () => {
    // Cathy's chop is the r3; the r2 on Bob's hand is the one card it needs.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["b4", "r2", "g2", "p4", "y4"],
        ["g4", "b4", "p3", "y3", "r3"],
      ],
      stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    });
    const red = judged(game, colorClue(BOB, "red"));
    const green = judged(game, colorClue(BOB, "green"));
    expect(conventions(red)).toContain("one-away-from-playable");
    expect(conventions(green)).not.toContain("one-away-from-playable");
    expect(red.category).toBe(green.category);
    expect(red.score).toBeGreaterThan(green.score);
    expect(conventions(judged(game, colorClue(BOB, "red"), 1))).not.toContain(
      "one-away-from-playable",
    );
  });

  it("favor a play clue that keeps the next player from discarding one", () => {
    // Bob's chop is the r3 (only the r2 is missing); a play clue to Bob keeps him off his chop.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["b4", "g2", "p4", "y4", "r3"],
        ["g4", "b2", "p3", "y3", "p4"],
      ],
      stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    });
    const toBob = judged(game, colorClue(BOB, "green"));
    const toCathy = judged(game, colorClue(CATHY, "blue"));
    expect(conventions(toBob)).toContain("one-away-from-playable");
    expect(conventions(toCathy)).not.toContain("one-away-from-playable");
    expect(toBob.score).toBeGreaterThan(toCathy.score);
  });

  it("count a clued card toward the gap", () => {
    // The site's example: Bob's r2 is 2 Saved, so Cathy's chop r3 needs only the r1.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["r1", "r2*", "g4", "p4", "y4"],
        ["g4", "b4", "p3", "y3", "r3"],
      ],
      stacks: { yellow: 1, green: 1, blue: 1, purple: 1 },
    });
    expect(conventions(judged(game, colorClue(BOB, "red")))).toContain("one-away-from-playable");
  });
});
