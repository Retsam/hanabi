// Scenario tests for level 1 clue reading, mostly taken from the H-Group beginner's guide examples.
// See docs/conventions/level-1.md.
import { playerView } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { chop, privateKnowledge, readGame } from "./knowledge.ts";
import { common, lastReading, names, own, read } from "./testing/knowledge.ts";
import { forRandomGames } from "./testing/randomGames.ts";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

describe("chop", () => {
  // beginner/chop: "Without Clues" and "With Clues".
  it("is the oldest card when nothing is clued", () => {
    const game = deal({
      hands: [
        ["y3", "b1", "y2", "g1", "r5"],
        ["g5", "r2", "b4", "b3", "r3"],
      ],
    });
    const knowledge = read(game, ALICE);
    expect(chop(knowledge, ALICE)).toBe(game.cardAt(4, ALICE));
    expect(chop(knowledge, BOB)).toBe(game.cardAt(4, BOB));
  });

  it("is the oldest unclued card, or nothing in a fully clued hand", () => {
    const game = deal({
      hands: [
        ["r2", "r3", "r3", "b4", "r5*"],
        ["b4", "b3", "g*3", "g*4", "g*5"],
      ],
    });
    const knowledge = read(game, ALICE);
    expect(chop(knowledge, ALICE)).toBe(game.cardAt(3, ALICE));
    expect(chop(knowledge, BOB)).toBe(game.cardAt(1, BOB));

    const locked = game.clue(BOB, "blue");
    expect(chop(read(locked, ALICE), BOB)).toBeNull();
  });

  it("skips a finessed card, which counts as clued", () => {
    // Nothing has played, so Alice's 2 clue on Cathy's r2 finesses Bob's r1, his only unclued card.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["r1", "y2*", "g2*", "b2*", "p2*"],
        ["g4", "r2", "b4", "p4", "y4"],
      ],
    }).clue(CATHY, 2);
    const knowledge = read(game, ALICE);
    expect(knowledge.finessed).toEqual([game.cardAt(0, BOB)]);
    expect(chop(knowledge, BOB)).toBeNull();
  });
});

describe("play clues", () => {
  // beginner/play-clues, first example: a red clue on slot 2 with nothing played is a red 1.
  it("make the focus the playable card of the clue", () => {
    const game = deal({
      hands: [
        ["g2", "y3", "b4", "p4", "g3"],
        ["g4", "r1", "y4", "b3", "p3"],
      ],
    }).clue(BOB, "red");
    const reading = lastReading(game, BOB);
    expect(reading).toMatchObject({ focus: game.cardAt(1, BOB), play: ["r1"], save: [] });
    expect(reading.conventions).toEqual(["clue-focus", "play-clue"]);
    expect(common(game, BOB, game.cardAt(1, BOB))).toEqual(["r1"]);
    // Everyone agrees, including the clue giver.
    expect(common(game, ALICE, game.cardAt(1, BOB))).toEqual(["r1"]);
  });

  // beginner/play-clues, second example: a 1 clue with red, green and purple started.
  it("leave every playable card the clue allows", () => {
    const game = deal({
      hands: [
        ["g2", "y3", "b4", "p4", "g3"],
        ["g4", "r4", "b1", "y3", "p5"],
      ],
      stacks: { red: 2, green: 1, purple: 3 },
    }).clue(BOB, 1);
    expect(lastReading(game, BOB).play).toEqual(["y1", "b1"]);
    expect(common(game, BOB, game.cardAt(2, BOB))).toEqual(["y1", "b1"]);
  });

  // beginner/delayed-play-clues: Cathy holds clued 1s, so Bob's 2 may wait for them.
  it("can be delayed through clued cards that were going to play anyway", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["p4", "y4", "b2", "y3", "g3"],
        ["r5", "y1*", "g1*", "b1*", "b5"],
      ],
      stacks: { red: 1 },
    }).clue(BOB, 2);
    const reading = lastReading(game, BOB);
    expect(reading.focus).toBe(game.cardAt(2, BOB));
    // Only Cathy's teammates can see her 1s, so as far as the table knows one could be the p1.
    expect(reading.play).toEqual(["r2", "y2", "g2", "b2", "p2"]);
    expect(reading.conventions).toContain("delayed-play-clue");
    // Bob sees that none of them is.
    expect(own(game, BOB, game.cardAt(2, BOB))).toEqual(["r2", "y2", "g2", "b2"]);
  });

  it("are a tempo clue when they touch nothing new", () => {
    // beginner/minimum-clue-value-principle: Bob's 2-saved card is filled in as the red 2.
    const game = deal({
      hands: [
        ["r5", "y5", "g5", "b5", "p5"],
        ["b4", "g4", "y4", "p4", "r2*"],
      ],
      stacks: { red: 1, yellow: 3, green: 3, purple: 3 },
    }).clue(BOB, "red");
    const reading = lastReading(game, BOB);
    expect(reading).toMatchObject({ focus: game.cardAt(4, BOB), play: ["r2"] });
    expect(common(game, BOB, game.cardAt(4, BOB))).toEqual(["r2"]);
  });

  it("mean nothing when no card they could be on is playable", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["y4", "b3", "g2", "y3", "g3"],
      ],
    }).clue(BOB, 4);
    const reading = lastReading(game, BOB);
    expect(reading).toMatchObject({ play: [], save: [], conventions: [] });
    // Off-convention clues carry only their rules-level information.
    expect(common(game, BOB, game.cardAt(0, BOB))).toEqual(["r4", "y4", "g4", "b4", "p4"]);
  });
});

describe("save clues", () => {
  // beginner/5-save.
  it("read a 5 clue on chop as a 5 Save", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["y4", "b3", "g2", "y3", "g5"],
      ],
    }).clue(BOB, 5);
    const reading = lastReading(game, BOB);
    expect(reading).toMatchObject({ play: [], save: ["r5", "y5", "g5", "b5", "p5"] });
    expect(reading.conventions).toEqual(["clue-focus", "save-clue", "5-save"]);
  });

  it("read a 5 clue off chop as a play clue", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["y5", "b3", "g2", "y3", "g3"],
      ],
      stacks: { yellow: 4 },
    }).clue(BOB, 5);
    expect(lastReading(game, BOB)).toMatchObject({ play: ["y5"], save: [] });
  });

  // beginner/2-save.
  it("read a 2 clue on chop as a 2 Save on any 2 that is not trash", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["y4", "b3", "g3", "y3", "b2"],
      ],
      stacks: { green: 2 },
    }).clue(BOB, 2);
    expect(lastReading(game, BOB)).toMatchObject({ play: [], save: ["r2", "y2", "b2", "p2"] });
  });

  // level-1#the-visible-rule: Bob saw Cathy's r2, off her chop, so his 2 Save isn't on a red 2.
  it("let a player who sees the other copy rule a 2 Save on it out", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "g4", "y4", "p2"],
        ["b4", "g3", "b3", "y4", "r4"],
        ["g4", "r2", "p4", "y3", "g5"],
      ],
      stacks: { yellow: 1, green: 1, blue: 2, purple: 1 },
    })
      .clue(CATHY, 5)
      .clue(ALICE, 2);
    const alices2 = game.cardAt(4, ALICE);
    // The table can't see every hand, so common knowledge keeps the red 2.
    expect(common(game, ALICE, alices2)).toEqual(["r2", "y2", "g2", "p2"]);
    expect(own(game, ALICE, alices2)).toEqual(["y2", "g2", "p2"]);
  });

  // level-1#the-visible-rule, Double Chop 2's: a 2 on its holder's chop could be saved by either clue.
  it("keep a 2 Save on a 2 whose other copy is on its holder's chop", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "g4", "y4", "p2"],
        ["b4", "g3", "b3", "y4", "r4"],
        ["g4", "p4", "y3", "r2", "g5"],
      ],
      stacks: { yellow: 1, green: 1, blue: 2, purple: 1 },
    })
      .clue(CATHY, 5)
      .clue(ALICE, 2);
    expect(own(game, ALICE, game.cardAt(4, ALICE))).toEqual(["r2", "y2", "g2", "p2"]);
  });

  // beginner/critical-save: blue on chop is a play clue on b2 or a critical save on b4.
  it("read a color clue on chop as a play clue or a Critical Save", () => {
    const game = deal({
      hands: [
        ["r2", "y2", "g1", "p2", "r4"],
        ["r3", "y3", "p1", "b4", "g5*"],
      ],
      stacks: { red: 1, yellow: 1, blue: 1 },
      discardPile: ["b4"],
    }).clue(BOB, "blue");
    const reading = lastReading(game, BOB);
    expect(reading).toMatchObject({ focus: game.cardAt(3, BOB), play: ["b2"], save: ["b4"] });
    expect(reading.conventions).toEqual(["clue-focus", "save-clue", "critical-save", "play-clue"]);
    expect(reading.interpretations).toEqual([
      {
        kind: "save",
        focusIdentity: { suit: "blue", rank: 4 },
        connections: [],
        conventions: ["save-clue", "critical-save"],
        ruledOutOn: null,
      },
      {
        kind: "play",
        focusIdentity: { suit: "blue", rank: 2 },
        connections: [],
        conventions: ["play-clue"],
        ruledOutOn: null,
      },
    ]);
    expect(common(game, BOB, game.cardAt(3, BOB))).toEqual(["b2", "b4"]);
    // The 5 Save card was not touched by blue.
    expect(common(game, BOB, game.cardAt(4, BOB))).toEqual(["r5", "y5", "g5", "p5"]);
  });

  // beginner/save-principle: saving the last b3 touches both b4s too.
  it("leave the other touched cards as any card of the clue that is not trash", () => {
    const game = deal({
      hands: [
        ["r4", "y2", "g1", "p2", "y4"],
        ["b4", "r3", "g1", "b4", "b3"],
      ],
      stacks: { red: 3, green: 2, blue: 1 },
      discardPile: ["b3"],
    }).clue(BOB, "blue");
    expect(lastReading(game, BOB)).toMatchObject({ play: ["b2"], save: ["b3"] });
    expect(common(game, BOB, game.cardAt(4, BOB))).toEqual(["b2", "b3"]);
    expect(common(game, BOB, game.cardAt(0, BOB))).toEqual(["b2", "b3", "b4", "b5"]);
    expect(common(game, BOB, game.cardAt(3, BOB))).toEqual(["b2", "b3", "b4", "b5"]);
  });
});

describe("Good Touch", () => {
  // beginner/good-touch-principle, third example.
  it("rules out trash and the focus's card for the other touched cards", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["b4", "y3", "y5", "g3", "p3"],
      ],
      stacks: { red: 1, yellow: 2, blue: 1 },
    }).clue(BOB, "yellow");
    expect(common(game, BOB, game.cardAt(1, BOB))).toEqual(["y3"]);
    expect(common(game, BOB, game.cardAt(2, BOB))).toEqual(["y4", "y5"]);
  });

  // beginner/good-touch-principle, second example: purple is up to 4, so the purple card is p5.
  it("rules out cards that have already played", () => {
    const game = deal({
      hands: [
        ["r3", "g4", "y4", "p*5", "b4"],
        ["p4", "b3", "g2", "y3", "g3"],
      ],
      stacks: { purple: 4 },
    });
    expect(common(game, ALICE, game.cardAt(3, ALICE))).toEqual(["p5"]);
  });

  it("leaves the other touched card bad touched when only the focus's card would be good", () => {
    // Alice's 5 clue touches Bob's y5 (the focus) and g5, trash since both g3s are gone. The other
    // 5's have played, so Good Touch alone would make the g5 the y5, leaving the focus only the trash
    // g5. The focus's reading comes first: it is the y5, and the other 5 is bad touched.
    const game = deal({
      hands: [
        ["r3", "y3", "b3", "p3", "r4"],
        ["b4", "y5", "g5", "r2", "p2"],
        ["r1", "b1", "g4", "p4", "y4"],
      ],
      stacks: { red: 5, yellow: 4, green: 2, blue: 5, purple: 5 },
      discardPile: ["g3", "g3"],
    }).clue(BOB, 5);
    expect(lastReading(game, ALICE).play).toEqual(["y5"]);
    expect(common(game, BOB, game.cardAt(1, BOB))).toEqual(["y5"]);
    expect(common(game, BOB, game.cardAt(2, BOB))).toEqual(["g5"]);
  });

  it("counts a clued card the clue itself pins down when reading the focus", () => {
    // Cathy's slot 2 was clued blue: b1 to play or a later blue card. Alice's 1 clue touches it
    // again, with a trash y1 as the focus. The clue itself makes the blue card the b1, so the focus
    // can't be the b1 too: it reads as nothing, and the blue card is the one to play.
    const game = deal({
      hands: [
        ["r3", "y3", "g3", "p3", "r4"],
        ["g4", "b4", "r2", "p4", "y5"],
        ["y1", "g5", "b*1", "r5", "p5"],
      ],
      stacks: { red: 1, yellow: 3, green: 1, purple: 1 },
    }).clue(CATHY, 1);
    expect(lastReading(game, CATHY).play).toEqual([]);
    expect(common(game, CATHY, game.cardAt(2, CATHY))).toEqual(["b1"]);
    expect(common(game, CATHY, game.cardAt(0, CATHY))).not.toEqual(["b1"]);
  });

  it("is off at level 0, where clues carry only rules-level information", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["b4", "y3", "y5", "g3", "p3"],
      ],
      stacks: { red: 1, yellow: 2, blue: 1 },
    }).clue(BOB, "yellow");
    const knowledge = read(game, BOB, 0);
    expect(knowledge.readings[0]!.conventions).toEqual([]);
    // The played yellow 1 and 2 each have a copy left, so the rules can't rule them out.
    expect(names(knowledge.common[game.cardAt(2, BOB)]!)).toEqual(["y1", "y2", "y3", "y4", "y5"]);
  });
});

describe("privateKnowledge", () => {
  it("adds what the viewer sees to common knowledge", () => {
    // Bob's and Cathy's chop 2s are both 2-saved. Bob sees Cathy's is the red 2, so his is not.
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["b4", "y3", "y5", "g3", "y2*"],
        ["b5", "y4", "g4", "b3", "r2*"],
      ],
    });
    const knowledge = read(game, BOB);
    const bobs2 = game.cardAt(4, BOB);
    expect(names(knowledge.common[bobs2]!)).toEqual(["r2", "y2", "g2", "b2", "p2"]);
    expect(names(privateKnowledge(playerView(game.state, BOB), knowledge)[bobs2]!)).toEqual([
      "y2",
      "g2",
      "b2",
      "p2",
    ]);
  });

  // beginner/save-principle: a save may break Good Touch.
  it("leaves a save's giver's clued card open to being a copy of the saved card", () => {
    // Alice's clued 2 could be the y2 she saves on Bob's chop.
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "y2*"],
        ["b4", "g4", "p4", "r4", "y2"],
      ],
    }).clue(BOB, 2);
    expect(own(game, ALICE, game.cardAt(4, ALICE))).toContain("y2");
    // Once the table knows Bob's card is the y2, Alice's 2 still may be the other one.
    const yellow = game.clue(ALICE, "red").clue(BOB, "yellow");
    expect(common(yellow, ALICE, yellow.cardAt(4, BOB))).toEqual(["y2"]);
    expect(common(yellow, ALICE, yellow.cardAt(4, ALICE))).toContain("y2");
  });

  it("still rules out a saved card's identity for the giver's cards clued after the save", () => {
    // Alice 2 Saves Bob's y2, then Cathy clues 2 on Alice's r2. Only cards already clued when Alice
    // gave the save could be a copy she didn't see. Cathy could see the saved y2 when she clued
    // Alice's 2, so by Good Touch Alice knows her 2 is not a y2.
    const game = deal({
      hands: [
        ["r3", "r4", "r2", "p3", "g4"],
        ["b4", "g4", "p4", "r4", "y2"],
        ["b3", "g3", "p5", "b5", "y4"],
      ],
      stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    })
      .clue(BOB, 2)
      .discard(3)
      .clue(ALICE, 2);
    expect(own(game, ALICE, game.cardAt(2, ALICE))).not.toContain("y2");
  });

  it("still rules out copies of a play clue's card", () => {
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "y2*"],
        ["b4", "g4", "p4", "r4", "y2"],
      ],
      stacks: { yellow: 1 },
    }).clue(BOB, "yellow");
    expect(own(game, ALICE, game.cardAt(4, ALICE))).not.toContain("y2");
  });

  it("keeps the focus's reading over a Good Touch guess about another touched card", () => {
    // Alice's blue clue touches Cathy's b3 (the focus) and trash b2. The table reads the focus as
    // b3, or b4 through a prompt on Bob's clued blue card, and Good Touch makes the b2 one of those
    // too. Cathy sees Bob's card is the b4, so her focus is the last b3 and the other blue card is
    // bad touched, not the b3.
    const game = deal({
      hands: [
        ["r3", "y3", "g3", "p3", "y4"],
        ["g4", "b*4", "r4", "p4", "y5"],
        ["b3", "g5", "b2", "r5", "p5"],
      ],
      stacks: { blue: 2 },
      discardPile: ["b3", "b5"],
    }).clue(CATHY, "blue");
    const focus = game.cardAt(0, CATHY);
    const other = game.cardAt(2, CATHY);
    expect(common(game, CATHY, focus)).toEqual(["b3", "b4"]);
    expect(common(game, CATHY, other)).toEqual(["b3", "b4"]);
    expect(own(game, CATHY, focus)).toEqual(["b3"]);
    expect(own(game, CATHY, other)).toEqual(["b1", "b2", "b4"]);
  });
});

describe("readGame over random games", { timeout: 60_000 }, () => {
  it("never leaves a card with no possibilities", () => {
    forRandomGames(10, ({ state }, seat) => {
      const view = playerView(state, seat);
      const knowledge = readGame(view, 1);
      expect(knowledge.readings).toHaveLength(view.log.filter((e) => e.type === "clue").length);
      expect(knowledge.common.filter((note) => note.length === 0)).toEqual([]);
      const ownNotes = privateKnowledge(view, knowledge);
      expect(ownNotes.filter((note) => note.length === 0)).toEqual([]);
    });
  });

  it("reads the same common knowledge from every seat", () => {
    forRandomGames(20, ({ state }) => {
      const [first, ...others] = state.hands.map((_, seat) => readGame(playerView(state, seat), 1));
      for (const knowledge of others) {
        expect(knowledge.common).toEqual(first!.common);
        expect(knowledge.readings).toEqual(first!.readings);
      }
    });
  });
});
