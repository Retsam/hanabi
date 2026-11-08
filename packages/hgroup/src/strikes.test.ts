// Scenario tests for what the table reads after a misplay (level 2), from the H-Group site's
// level 2 "Common Mistakes" section. See docs/conventions/level-2.md.
import { playerView } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { privateKnowledge } from "./knowledge.ts";
import { rankMoves } from "./moves.ts";
import { names, read } from "./testing/knowledge.ts";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

/** The top-ranked move for whoever is to play, at `level`. */
const top = (game: ReturnType<typeof deal>, level = 2) =>
  rankMoves(playerView(game.state, game.state.currentPlayer), level)[0]!;
const playOf = (id: number) => ({ type: "play", cardId: id });
/** What `seat` knows a card could be, at `level`, as card names. */
const knows = (game: ReturnType<typeof deal>, seat: number, id: number, level = 2) =>
  names(privateKnowledge(playerView(game.state, seat), read(game, seat, level))[id]!);

describe("after a strike", () => {
  // level-2#what-to-do-after-a-strike: Alice's red clue on Cathy's r3 finesses Bob for the r2, but
  // his finesse position is the g4 and misplays. Cathy mustn't go on to play her red card as the
  // r2: the clue that caused the strike means nothing now.
  const misplayed = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["g4", "b4", "p4", "y5", "b5"],
      ["p2", "r3", "g2", "b2", "y2"],
    ],
    stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    clueTokens: 6,
  })
    .clue(CATHY, "red")
    .play(0);
  const cathysRed = misplayed.cardAt(1, CATHY);

  it("make the table forget what the clue that caused it said", () => {
    expect(misplayed.state.strikes).toBe(1);
    // Any red card but the r1, which is trash (Good Touch still holds).
    expect(knows(misplayed, CATHY, cathysRed)).toEqual(["r2", "r3", "r4", "r5"]);
    expect(top(misplayed).action).not.toEqual(playOf(cathysRed));
  });

  it("are read the old way at level 1", () => {
    // At level 1 the finesse is ruled out and Cathy is left with the direct play clue on the r2.
    expect(knows(misplayed, CATHY, cathysRed, 1)).toEqual(["r2"]);
  });
});

describe("wrong prompts", () => {
  // level-2#the-wrong-prompt: Alice means to finesse Bob's r2, forgetting his clued red card. Bob
  // plays it as the r2, but it is the r4. He then blind-plays his old finesse position, now slot 2.
  const prompted = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["r2", "b4", "r*4", "y5", "b5"],
      ["p2", "r3", "g2", "b2", "y2"],
    ],
    stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    clueTokens: 6,
  }).clue(CATHY, "red");
  const bobsTwo = prompted.cardAt(0, BOB);
  const cathysRed = prompted.cardAt(1, CATHY);

  it("make the prompted player blind-play their finesse position next", () => {
    expect(top(prompted).action).toEqual(playOf(prompted.cardAt(2, BOB)));
    const misplayed = prompted.play(2);
    expect(misplayed.state.strikes).toBe(1);
    const waited = misplayed.discard(4).discard(4);
    // The r2 moved to slot 2 when Bob drew.
    expect(waited.cardAt(1, BOB)).toBe(bobsTwo);
    expect(top(waited)).toMatchObject({ action: playOf(bobsTwo), category: "mandated" });
    const played = waited.play(1);
    expect(played.state.strikes).toBe(1);
    expect(knows(played, CATHY, cathysRed)).toEqual(["r3"]);
  });

  it("keep the clue's other readings open meanwhile", () => {
    // Cathy can't see Bob's r2, so her red card could still be the r2 itself, or the r3.
    const misplayed = prompted.play(2);
    expect(knows(misplayed, CATHY, cathysRed)).toEqual(["r2", "r3"]);
    expect(knows(misplayed, ALICE, cathysRed)).toEqual(["r3"]);
  });
});
