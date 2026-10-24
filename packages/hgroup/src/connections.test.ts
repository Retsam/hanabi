// Scenario tests for prompts and finesses at level 1, mostly taken from the H-Group beginner's guide
// examples. See docs/conventions/level-1.md.
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { playerView } from "@hanabi/engine";
import { finessePosition, privateKnowledge } from "./knowledge.ts";
import { rankMoves } from "./moves.ts";
import { common, lastReading, names, own, read } from "./testing/knowledge.ts";

const ALICE = 0;
const BOB = 1;
const CATHY = 2;
const DONALD = 3;

describe("prompts", () => {
  // beginner/prompt, first example: Alice's red clue on Cathy's r4 prompts Bob's red card.
  const prompt = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["g4", "b4", "r*3", "p4", "y4"],
      ["g5", "r4", "b5", "p5", "y5"],
    ],
    stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
  }).clue(CATHY, "red");
  const bobsRed = prompt.cardAt(2, BOB);
  const cathysRed = prompt.cardAt(1, CATHY);

  it("read a clue one away from playable as a prompt on a clued card that could connect", () => {
    const reading = lastReading(prompt, ALICE);
    expect(reading.play).toEqual(["r3", "r4"]);
    expect(
      reading.interpretations.map(({ focusIdentity, connections }) => [
        names([focusIdentity]),
        connections,
      ]),
    ).toEqual([
      [["r3"], []],
      [["r4"], [{ kind: "prompt", seat: BOB, card: { suit: "red", rank: 3 }, ids: [bobsRed] }]],
    ]);
    expect(reading.conventions).toContain("prompt");
    // Bob has a red card that could be the r3, so his finesse position is not considered.
    expect(reading.conventions).toContain("prompts-before-finesses");
    expect(reading.conventions).not.toContain("finesse");
  });

  it("leave the table unsure until the prompt plays", () => {
    expect(common(prompt, ALICE, cathysRed)).toEqual(["r3", "r4"]);
    expect(common(prompt, ALICE, bobsRed)).toEqual(["r3", "r4", "r5"]);
  });

  it("tell the prompted player what their card is once they see the focus", () => {
    expect(own(prompt, BOB, bobsRed)).toEqual(["r3"]);
    // Cathy sees Bob's clued r3, so under Good Touch her card is the r4.
    expect(own(prompt, CATHY, cathysRed)).toEqual(["r4"]);
  });

  it("are resolved when the prompted card plays", () => {
    const played = prompt.play(2);
    expect(common(played, ALICE, cathysRed)).toEqual(["r4"]);
    expect(read(played, ALICE).readings[0]!.interpretations.map((i) => i.ruledOutOn)).toEqual([
      1,
      null,
    ]);
  });

  // beginner/prompt, second example: with two unknown red cards, the leftmost is prompted.
  it("list the prompted player's possible cards leftmost first", () => {
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g4", "b4", "p4", "r*3", "r*5"],
        ["g5", "r4", "b5", "p5", "y5"],
      ],
      stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
    }).clue(CATHY, "red");
    const [, prompted] = read(game, BOB).readings[0]!.interpretations;
    expect(prompted!.connections[0]!.ids).toEqual([game.cardAt(3, BOB), game.cardAt(4, BOB)]);
    // Bob knows one of them is the r3 but not which, so neither card is pinned down. (Neither is
    // the r4, since he sees Cathy's.)
    expect(own(game, BOB, game.cardAt(3, BOB))).toEqual(["r3", "r5"]);
  });

  // beginner/prompt, third example: a 4 clue that no 4 can be playable for prompts Bob's own 3.
  it("can prompt the clue receiver's own clued cards", () => {
    const game = deal({
      hands: [
        ["r5", "y5", "g5", "p5", "r4"],
        ["p2", "b4", "y2", "b3*", "r2"],
      ],
      stacks: { red: 1, yellow: 1, green: 2, blue: 2, purple: 1 },
    }).clue(BOB, 4);
    const four = game.cardAt(1, BOB);
    const three = game.cardAt(3, BOB);
    expect(common(game, BOB, four)).toEqual(["g4", "b4"]);
    expect(common(game, BOB, three)).toEqual(["g3", "b3"]);

    // The 3 plays as the blue 3, so the green 4 is ruled out.
    const played = game.play(3);
    expect(common(played, BOB, four)).toEqual(["b4"]);
  });

  // beginner/prompt, fourth example: the prompt is a promise, so Bob plays his 3s left to right.
  it("move to the next card when the leftmost turns out to be another card", () => {
    const game = deal({
      hands: [
        ["y2", "g4", "b4", "p4", "y4"],
        ["g5", "b3*", "g3*", "r3*", "p2"],
        ["b5", "p5", "r4", "y5", "g4"],
      ],
      stacks: { red: 2, yellow: 1, green: 2, blue: 2, purple: 1 },
      clueTokens: 4,
    }).clue(CATHY, "red");
    const lastThree = game.cardAt(3, BOB);
    // One of Bob's three 3s is the r3, but he can't tell which yet.
    expect(own(game, BOB, lastThree)).toEqual(["r3", "y3", "g3", "b3", "p3"]);

    // Bob plays the b3 and then the g3, each played successfully, with Cathy and Alice discarding.
    const later = game.play(1).discard(4).discard(4).play(2);
    expect(own(later, BOB, lastThree)).toEqual(["r3"]);
    expect(own(later, CATHY, game.cardAt(2, CATHY))).toEqual(["r4"]);
  });
});

describe("finesses", () => {
  // beginner/finesse, first example: Bob has no clued cards, so he must hold the r3 in slot 1.
  const finesse = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["r3", "g4", "b4", "p4", "y4"],
      ["g5", "b5", "r4", "p5", "y5"],
    ],
    stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
  }).clue(CATHY, "red");
  const bobsFinessePosition = finesse.cardAt(0, BOB);
  const cathysRed = finesse.cardAt(2, CATHY);

  it("read a clue one away from playable as a finesse on a player before the receiver", () => {
    const reading = lastReading(finesse, ALICE);
    expect(reading.play).toEqual(["r3", "r4"]);
    expect(reading.interpretations[1]!.connections).toEqual([
      { kind: "finesse", seat: BOB, card: { suit: "red", rank: 3 }, ids: [bobsFinessePosition] },
    ]);
    expect(reading.conventions).toEqual(expect.arrayContaining(["finesse", "finesse-position"]));
  });

  it("tell the finessed player to blind-play their finesse position", () => {
    expect(own(finesse, BOB, bobsFinessePosition)).toEqual(["r3"]);
    // Cathy sees Bob's r3, so she can't tell yet whether her card is the r3 or the r4.
    expect(own(finesse, CATHY, cathysRed)).toEqual(["r3", "r4"]);
  });

  it("are resolved when the finessed card plays", () => {
    expect(common(finesse.play(0), CATHY, cathysRed)).toEqual(["r4"]);
  });

  it("are ruled out when the finessed player does something else", () => {
    // Here Cathy's red card is the r3 itself, and Bob's finesse position is not.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g4", "r4", "b4", "p4", "y4"],
        ["g5", "b5", "r3", "p5", "y5"],
      ],
      stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
    }).clue(CATHY, "red");
    expect(common(game, CATHY, game.cardAt(2, CATHY))).toEqual(["r3", "r4"]);
    // Cathy sees Bob's finesse position is not the r3, so she knows already.
    expect(own(game, CATHY, game.cardAt(2, CATHY))).toEqual(["r3"]);

    const discarded = game.discard(4);
    expect(common(discarded, CATHY, game.cardAt(2, CATHY))).toEqual(["r3"]);
    const [, finessed] = read(discarded, CATHY).readings[0]!.interpretations;
    expect(finessed!.ruledOutOn).toBe(1);
  });

  // beginner/finesse, second example: Cathy's finesse position moves past her clued cards.
  it("are on the leftmost unclued card", () => {
    const game = deal({
      hands: [
        ["y3", "g3", "p3", "y4"],
        ["g4", "p4", "y5", "g5"],
        ["r1", "r2", "b1", "g2"],
        ["b2", "r5", "p5", "y4"],
      ],
    })
      .clue(CATHY, "red")
      .clue(DONALD, "blue");
    const knowledge = read(game, CATHY);
    // Bob did not blind-play after Alice's red clue, so Cathy's slot 1 is the r1.
    expect(names(knowledge.common[game.cardAt(0, CATHY)]!)).toEqual(["r1"]);
    const [, finessed] = knowledge.readings[1]!.interpretations;
    expect(finessed!.connections[0]).toMatchObject({ seat: CATHY, ids: [game.cardAt(2, CATHY)] });
    expect(own(game, CATHY, game.cardAt(2, CATHY))).toEqual(["b1"]);
  });

  it("make the finessed card count as clued once nothing else can explain the clue", () => {
    // No 2 but the b2 can be playable, so Cathy's finesse position must be the b1.
    const game = deal({
      hands: [
        ["y3", "g3", "p3", "y4"],
        ["g4", "p4", "y5", "g5"],
        ["b1", "r3", "y3", "g3"],
        ["b2", "r5", "p5", "y4"],
      ],
      stacks: { red: 2, yellow: 2, green: 2, purple: 2 },
      clueTokens: 4,
    })
      .discard(3)
      .clue(DONALD, 2);
    const knowledge = read(game, ALICE);
    expect(knowledge.finessed).toEqual([game.cardAt(0, CATHY)]);
    expect(names(knowledge.common[game.cardAt(0, CATHY)]!)).toEqual(["b1"]);
    expect(finessePosition(knowledge, CATHY)).toBe(game.cardAt(1, CATHY));
  });

  it("are not looked for on the receiver or on players after them at level 1", () => {
    // Bob is the receiver and Cathy plays after him: those would be a self- or reverse finesse.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g5", "b5", "r4", "p5", "y5"],
        ["r3", "g4", "b4", "p4", "y4"],
      ],
      stacks: { red: 2, yellow: 2, green: 2, blue: 2, purple: 2 },
    }).clue(BOB, "red");
    expect(lastReading(game, ALICE).play).toEqual(["r3"]);
  });
});

describe("chains of connections", () => {
  // beginner/delayed-play-clues: a play clue can wait on any number of cards that play anyway.
  // Here Bob's 2 plays anyway (every 2 is playable), so it costs nothing and his 3 can still be
  // prompted.
  it("can pass through cards that play anyway before a prompt at level 1", () => {
    const game = deal({
      hands: [
        ["y3", "g3", "p3", "r4", "y4"],
        ["b2*", "b3*", "g4", "p4", "y5"],
        ["g5", "b4", "r5", "p5", "g4"],
      ],
      stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    }).clue(CATHY, "blue");
    const reading = lastReading(game, ALICE);
    expect(reading.play).toEqual(["b2", "b3", "b4"]);
    const b4 = reading.interpretations.find(({ focusIdentity }) => focusIdentity.rank === 4)!;
    expect(b4.connections.map(({ seat, card }) => [seat, names([card])[0]])).toEqual([
      [BOB, "b2"],
      [BOB, "b3"],
    ]);
    expect(b4.conventions).toEqual(expect.arrayContaining(["delayed-play-clue", "prompt"]));
    expect(b4.conventions).not.toContain("multi-prompt");
  });

  // level-2#the-double-prompt: Cathy's y5 needs both of Bob's unidentified yellow cards, the
  // position Retsam asked about (game-delayed-y5, turn 19).
  const doublePrompt = deal({
    hands: [
      ["r3", "b3", "p3", "r4", "b4"],
      ["b5", "y*3", "y*4", "p4", "r5"],
      ["b1", "y5", "p2", "r1", "p4"],
    ],
    stacks: { red: 2, yellow: 2, green: 4, blue: 2, purple: 2 },
    clueTokens: 6,
  }).clue(CATHY, 5);
  const cathysFive = doublePrompt.cardAt(1, CATHY);

  it("needs Double Prompts (level 2) to read a clue through two prompts", () => {
    expect(
      names(read(doublePrompt, ALICE, 1).readings[0]!.interpretations.map((i) => i.focusIdentity)),
    ).toEqual(["g5"]);
    const reading = read(doublePrompt, ALICE, 2).readings[0]!;
    const [yellow] = reading.interpretations;
    expect(names([yellow!.focusIdentity])).toEqual(["y5"]);
    expect(yellow!.conventions).toEqual(expect.arrayContaining(["prompt", "multi-prompt"]));
    expect(yellow!.connections).toEqual([
      {
        kind: "prompt",
        seat: BOB,
        card: { suit: "yellow", rank: 3 },
        ids: [doublePrompt.cardAt(1, BOB), doublePrompt.cardAt(2, BOB)],
      },
      {
        kind: "prompt",
        seat: BOB,
        card: { suit: "yellow", rank: 4 },
        ids: [doublePrompt.cardAt(2, BOB)],
      },
    ]);
    expect(names(reading.interpretations.map((i) => i.focusIdentity))).toEqual(["y5", "g5"]);
  });

  it("tell the prompted player to play their cards left to right", () => {
    const view = playerView(doublePrompt.state, BOB);
    const bob = privateKnowledge(view, read(doublePrompt, BOB, 2));
    // Bob sees Cathy's y5, so his yellow cards are the y3 and then the y4.
    expect(names(bob[doublePrompt.cardAt(1, BOB)]!)).toEqual(["y3"]);
    expect(names(bob[doublePrompt.cardAt(2, BOB)]!)).toEqual(["y4"]);
    expect(rankMoves(view, 2)[0]).toMatchObject({
      action: { type: "play", cardId: doublePrompt.cardAt(1, BOB) },
      category: "mandated",
    });
    expect(names(read(doublePrompt, CATHY, 2).common[cathysFive]!)).toEqual(["y5", "g5"]);
    // Once the y3 has played, the y4 is owed next.
    const later = doublePrompt.play(1).discard(4).discard(4);
    expect(rankMoves(playerView(later.state, BOB), 2)[0]).toMatchObject({
      action: { type: "play", cardId: doublePrompt.cardAt(2, BOB) },
      category: "mandated",
    });
  });
});
