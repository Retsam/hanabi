// Scenario tests for level 1 clue reading, mostly taken from the H-Group beginner's guide examples.
// See docs/conventions/level-1.md.
import { type Card, type CardId, playerView } from "@hanabi/engine";
import { deal, type Scenario } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { chop, privateKnowledge, readGame } from "./knowledge";
import { forRandomGames } from "./testing/randomGames";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;

/** Card names ("r4") for a list of identities, to keep expectations short. */
const names = (cards: readonly Card[]) => cards.map((card) => `${card.suit[0]}${card.rank}`);

/** The game read from `seat`'s view at a particular level (1 by default). */
const read = (game: Scenario, seat: number, level = 1) =>
  readGame(playerView(game.state, seat), level);

/** What the table agrees a card could be, as card names. */
const common = (game: Scenario, seat: number, id: CardId) => names(read(game, seat).common[id]!);

/** The latest clue's reading as card names. */
const lastReading = (game: Scenario, seat: number) => {
  const reading = read(game, seat).readings.at(-1)!;
  return { ...reading, play: names(reading.play), save: names(reading.save) };
};

describe("chop", () => {
  // beginner/chop: "Without Clues" and "With Clues".
  it("is the oldest card when nothing is clued", () => {
    const game = deal({
      hands: [
        ["y3", "b1", "y2", "g1", "r5"],
        ["g5", "r2", "b4", "b3", "r3"],
      ],
    });
    const { moment } = read(game, ALICE);
    expect(chop(moment, ALICE)).toBe(game.cardAt(4, ALICE));
    expect(chop(moment, BOB)).toBe(game.cardAt(4, BOB));
  });

  it("is the oldest unclued card, or nothing in a fully clued hand", () => {
    const game = deal({
      hands: [
        ["r2", "r3", "r3", "b4", "r5*"],
        ["b4", "b3", "g*3", "g*4", "g*5"],
      ],
    });
    const { moment } = read(game, ALICE);
    expect(chop(moment, ALICE)).toBe(game.cardAt(3, ALICE));
    expect(chop(moment, BOB)).toBe(game.cardAt(1, BOB));

    const locked = game.clue(BOB, "blue");
    expect(chop(read(locked, ALICE).moment, BOB)).toBeNull();
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
  it("can be delayed through clued cards the receiver can see", () => {
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
    expect(reading.play).toEqual(["r2", "y2", "g2", "b2"]);
    expect(reading.conventions).toContain("delayed-play-clue");
    expect(lastReading(game, ALICE).play).toEqual(["r2", "y2", "g2", "b2"]);
  });

  it("let the holder of the connecting cards allow for any of them", () => {
    // Cathy can't see her 1s, which could include the purple 1 as far as she knows.
    const game = deal({
      hands: [
        ["r3", "r4", "p4", "p3", "g4"],
        ["p4", "y4", "b2", "y3", "g3"],
        ["r5", "y1*", "g1*", "b1*", "b5"],
      ],
      stacks: { red: 1 },
    }).clue(BOB, 2);
    expect(lastReading(game, CATHY).play).toEqual(["r2", "y2", "g2", "b2", "p2"]);
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
});

describe("readGame over random games", { timeout: 60_000 }, () => {
  it("never leaves a card with no possibilities", () => {
    forRandomGames(10, ({ state }, seat) => {
      const view = playerView(state, seat);
      const knowledge = readGame(view, 1);
      expect(knowledge.readings).toHaveLength(view.log.filter((e) => e.type === "clue").length);
      expect(knowledge.common.filter((note) => note.length === 0)).toEqual([]);
    });
  });
});
