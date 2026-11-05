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

/** The top-ranked move for whoever is to play, at level 2. */
const top = (game: ReturnType<typeof deal>) =>
  rankMoves(playerView(game.state, game.state.currentPlayer), 2)[0]!;
const playOf = (id: number) => ({ type: "play", cardId: id });
/** How the player to move would judge playing `id`, at level 2. */
const playing = (game: ReturnType<typeof deal>, id: number) =>
  rankMoves(playerView(game.state, game.state.currentPlayer), 2).find(
    ({ action }) => action.type === "play" && action.cardId === id,
  )!;

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
      [
        ["r4"],
        [{ kind: "prompt", seat: BOB, card: { suit: "red", rank: 3 }, candidateIds: [bobsRed] }],
      ],
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
    expect(prompted!.connections[0]!.candidateIds).toEqual([
      game.cardAt(3, BOB),
      game.cardAt(4, BOB),
    ]);
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
      {
        kind: "finesse",
        seat: BOB,
        card: { suit: "red", rank: 3 },
        candidateIds: [bobsFinessePosition],
      },
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
    expect(finessed!.connections[0]).toMatchObject({
      seat: CATHY,
      candidateIds: [game.cardAt(2, CATHY)],
    });
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
  // position Retsam asked about (game-delayed-y5, turn 19). It is past the Early Game, so the 5 clue
  // is not a 5 Stall.
  const doublePrompt = deal({
    hands: [
      ["r3", "b3", "p3", "r4", "b4"],
      ["b5", "y*3", "y*4", "p4", "r5"],
      ["b1", "y5", "p2", "r1", "p4"],
    ],
    stacks: { red: 2, yellow: 2, green: 4, blue: 2, purple: 2 },
    discardPile: ["r1"],
    clueTokens: 6,
  }).clue(CATHY, 5);
  const cathysFive = doublePrompt.cardAt(1, CATHY);

  it("needs Double Prompts (level 2) to read a clue through two prompts", () => {
    expect(
      names(read(doublePrompt, ALICE, 1).readings[0]!.interpretations.map((i) => i.focusIdentity)),
    ).toEqual(["g5"]);
    const reading = read(doublePrompt, ALICE, 2).readings[0]!;
    const yellow = reading.interpretations.find((i) => i.focusIdentity.suit === "yellow");
    expect(yellow!.conventions).toEqual(expect.arrayContaining(["prompt", "multi-prompt"]));
    expect(yellow!.connections).toEqual([
      {
        kind: "prompt",
        seat: BOB,
        card: { suit: "yellow", rank: 3 },
        candidateIds: [doublePrompt.cardAt(1, BOB), doublePrompt.cardAt(2, BOB)],
      },
      {
        kind: "prompt",
        seat: BOB,
        card: { suit: "yellow", rank: 4 },
        candidateIds: [doublePrompt.cardAt(2, BOB)],
      },
    ]);
    // Bob's two unclued cards could also be a Double Finesse on any other 5 (`multi-finesse`).
    // Self-Finesses on Cathy are read too, but she only falls back on them.
    const others = reading.interpretations.filter((i) => !i.conventions.includes("self-finesse"));
    expect(names(others.map((i) => i.focusIdentity))).toEqual(["r5", "y5", "g5", "b5", "p5"]);
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
    // Cathy sees Bob's finesse positions hold no 3 or 4, so only the prompt or a direct play is left.
    const cathy = privateKnowledge(
      playerView(doublePrompt.state, CATHY),
      read(doublePrompt, CATHY, 2),
    );
    expect(names(cathy[cathysFive]!)).toEqual(["y5", "g5"]);
    // Once the y3 has played, the y4 is owed next.
    const later = doublePrompt.play(1).discard(4).discard(4);
    expect(rankMoves(playerView(later.state, BOB), 2)[0]).toMatchObject({
      action: { type: "play", cardId: doublePrompt.cardAt(2, BOB) },
      category: "mandated",
    });
  });
});

describe("finesse chains (level 2)", () => {
  // level-2#the-double-finesse, first example: Alice's red clue on Donald's r4 finesses Bob's r2
  // and then Cathy's r3.
  const acrossPlayers = deal({
    hands: [
      ["y3", "g3", "b3", "p3"],
      ["r2", "g4", "b4", "p4"],
      ["r3", "y4", "g4", "b4"],
      ["y5", "r4", "p4", "g5"],
    ],
    stacks: { red: 1, yellow: 0, green: 0, blue: 0, purple: 0 },
  }).clue(DONALD, "red");
  const donaldsRed = acrossPlayers.cardAt(1, DONALD);

  it("read a clue two away from playable as a Double Finesse on two players", () => {
    const focusNames = (level: number) =>
      names(
        read(acrossPlayers, ALICE, level).readings[0]!.interpretations.map((i) => i.focusIdentity),
      );
    // At level 1 the focus can be the r2, or the r3 with a finesse on Bob or on Cathy.
    expect(focusNames(1)).toEqual(["r2", "r3", "r3"]);
    expect(focusNames(2)).toEqual(expect.arrayContaining(["r4"]));
    const double = read(acrossPlayers, ALICE, 2).readings[0]!.interpretations.find(
      ({ focusIdentity, connections }) =>
        focusIdentity.rank === 4 && connections[1]?.seat === CATHY,
    )!;
    expect(double.conventions).toContain("multi-finesse");
    expect(double.connections).toEqual([
      {
        kind: "finesse",
        seat: BOB,
        card: { suit: "red", rank: 2 },
        candidateIds: [acrossPlayers.cardAt(0, BOB)],
      },
      {
        kind: "finesse",
        seat: CATHY,
        card: { suit: "red", rank: 3 },
        candidateIds: [acrossPlayers.cardAt(0, CATHY)],
      },
    ]);
  });

  it("have each finessed player blind-play in turn", () => {
    expect(top(acrossPlayers)).toMatchObject({
      action: playOf(acrossPlayers.cardAt(0, BOB)),
      category: "mandated",
    });
    const bobPlayed = acrossPlayers.play(0);
    expect(playing(bobPlayed, acrossPlayers.cardAt(0, CATHY))).toMatchObject({
      category: "mandated",
      reasons: [{ convention: "finesse" }],
    });
    const cathyPlayed = bobPlayed.play(0);
    // Cathy could be finessed again for an r4, but Donald sees her next card is not one.
    const donald = privateKnowledge(
      playerView(cathyPlayed.state, DONALD),
      read(cathyPlayed, DONALD, 2),
    );
    expect(names(donald[donaldsRed]!)).toEqual(["r4"]);
  });

  // level-2#the-double-finesse, second example: Bob is finessed twice, and Cathy waits a turn
  // because she saw the r2 next to Bob's r1.
  const sameHand = deal({
    hands: [
      ["y4", "g4", "b4", "p4", "y3"],
      ["r1", "r2", "g3", "b3", "p3"],
      ["g2", "b2", "r3", "p2", "y2"],
    ],
    clueTokens: 6,
  }).clue(CATHY, "red");
  const cathysRed = sameHand.cardAt(2, CATHY);

  it("can blind-play two cards from one hand, left to right", () => {
    const double = read(sameHand, ALICE, 2).readings[0]!.interpretations.find(
      (i) => i.focusIdentity.rank === 3,
    )!;
    expect(double.connections.map(({ seat, candidateIds }) => [seat, candidateIds])).toEqual([
      [BOB, [sameHand.cardAt(0, BOB)]],
      [BOB, [sameHand.cardAt(1, BOB)]],
    ]);
    expect(top(sameHand)).toMatchObject({ action: playOf(sameHand.cardAt(0, BOB)) });

    const bobPlayed = sameHand.play(0);
    const cathy = privateKnowledge(playerView(bobPlayed.state, CATHY), read(bobPlayed, CATHY, 2));
    expect(names(cathy[cathysRed]!)).toEqual(["r2", "r3"]);
    expect(top(bobPlayed).action).not.toEqual(playOf(cathysRed));

    // Cathy and Alice discard; the r2 is now on Bob's slot 2, and he blind-plays it.
    const cathyWaited = bobPlayed.discard(4).discard(4);
    expect(top(cathyWaited)).toMatchObject({
      action: playOf(sameHand.cardAt(1, BOB)),
      category: "mandated",
    });
    // Bob could be finessed a third time, but Cathy sees his next card is not the r4.
    const bobPlayedAgain = cathyWaited.play(1);
    const after = privateKnowledge(
      playerView(bobPlayedAgain.state, CATHY),
      read(bobPlayedAgain, CATHY, 2),
    );
    expect(names(after[cathysRed]!)).toEqual(["r3"]);
  });

  it("are ruled out when the second finessed card is not there", () => {
    // Bob's slot 2 is not the r2, so Cathy's red card is.
    const single = deal({
      hands: [
        ["y4", "g4", "b4", "p4", "y3"],
        ["r1", "g3", "r3", "b3", "p3"],
        ["g2", "b2", "r2", "p2", "y2"],
      ],
      clueTokens: 6,
    })
      .clue(CATHY, "red")
      .play(0);
    const red = single.cardAt(2, CATHY);
    const cathy = privateKnowledge(playerView(single.state, CATHY), read(single, CATHY, 2));
    expect(names(cathy[red]!)).toEqual(["r2"]);
    expect(top(single)).toMatchObject({ action: playOf(red) });
  });

  // level-2#the-prompt--finesse: Bob's clued red card is prompted as the r2, then his finesse
  // position blind-plays as the r3.
  const promptFinesse = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["r3", "g4", "b4", "r*2", "p4"],
      ["g5", "r4", "b5", "p5", "y5"],
    ],
    stacks: { red: 1, yellow: 0, green: 0, blue: 0, purple: 0 },
    clueTokens: 6,
  }).clue(CATHY, "red");
  const cathysFour = promptFinesse.cardAt(1, CATHY);

  it("read a Prompt + Finesse on one player", () => {
    const focusNames = (level: number) =>
      names(
        read(promptFinesse, ALICE, level).readings[0]!.interpretations.map((i) => i.focusIdentity),
      );
    expect(focusNames(1)).toEqual(["r2", "r3"]);
    const both = read(promptFinesse, ALICE, 2).readings[0]!.interpretations.find(
      (i) => i.focusIdentity.rank === 4,
    )!;
    expect(both.conventions).toContain("prompt-plus-finesse");
    expect(
      both.connections.map(({ kind, seat, candidateIds }) => [kind, seat, candidateIds]),
    ).toEqual([
      ["prompt", BOB, [promptFinesse.cardAt(3, BOB)]],
      ["finesse", BOB, [promptFinesse.cardAt(0, BOB)]],
    ]);
  });

  it("play the prompt first, then the finesse, while the receiver waits", () => {
    expect(top(promptFinesse)).toMatchObject({
      action: playOf(promptFinesse.cardAt(3, BOB)),
      category: "mandated",
      reasons: [{ convention: "prompt" }],
    });
    const prompted = promptFinesse.play(3);
    const cathy = privateKnowledge(playerView(prompted.state, CATHY), read(prompted, CATHY, 2));
    expect(names(cathy[cathysFour]!)).toEqual(["r3", "r4"]);
    expect(top(prompted).action).not.toEqual(playOf(cathysFour));

    // Cathy and Alice discard. The r3 slid to Bob's slot 2 when he drew.
    const waited = prompted.discard(4).discard(4);
    expect(top(waited)).toMatchObject({
      action: playOf(promptFinesse.cardAt(0, BOB)),
      category: "mandated",
      reasons: [{ convention: "finesse" }],
    });
    const finessed = waited.play(1);
    const after = privateKnowledge(playerView(finessed.state, CATHY), read(finessed, CATHY, 2));
    expect(names(after[cathysFour]!)).toEqual(["r4"]);
  });
});

describe("reverse finesses (level 2)", () => {
  // level-2#the-reverse-finesse, first example: Alice's red clue touches Bob's r2, and Cathy, who
  // plays after Bob, has the r1 on her finesse position. Bob waits for her.
  const beforeClue = deal({
    hands: [
      ["y3", "g3", "b3", "p3", "y4"],
      ["g4", "b4", "r2", "p4", "y5"],
      ["r1", "g2", "b2", "p2", "y2"],
    ],
  });
  const reverse = beforeClue.clue(BOB, "red");
  const bobsRed = reverse.cardAt(2, BOB);

  it("read a finesse on a player after the receiver at level 2 only", () => {
    const focusNames = (level: number) =>
      names(
        read(reverse, ALICE, level)
          .readings[0]!.interpretations.filter((i) => !i.conventions.includes("self-finesse"))
          .map((i) => i.focusIdentity),
      );
    expect(focusNames(1)).toEqual(["r1"]);
    // Common knowledge keeps Cathy finessed again for the r3 and on open: only seeing her hand
    // rules that out.
    expect(focusNames(2)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
    const reversed = read(reverse, ALICE, 2).readings[0]!.interpretations.find(
      (i) => i.focusIdentity.rank === 2 && i.connections[0]?.seat === CATHY,
    )!;
    expect(reversed.conventions).toContain("reverse-finesse");
    expect(reversed.connections).toEqual([
      {
        kind: "finesse",
        seat: CATHY,
        card: { suit: "red", rank: 1 },
        candidateIds: [reverse.cardAt(0, CATHY)],
      },
    ]);
  });

  it("are a permitted clue at level 2, and a misread at level 1", () => {
    const red = (level: number) =>
      rankMoves(playerView(beforeClue.state, ALICE), level).find(
        ({ action }) =>
          action.type === "clue" && action.target === BOB && action.clue.value === "red",
      )!;
    expect(red(2)).toMatchObject({
      category: "permitted",
      reasons: [{ convention: "reverse-finesse" }],
    });
    expect(red(1).category).toBe("violates");
  });

  it("don't hold up a receiver who sees the finesse position isn't the card", () => {
    // Blue on Bob's b4 and b5 could be a Reverse Finesse on the b5, with Cathy's finesse position
    // as the b4. Bob sees her r2 there, so he plays his b4 and won't discard his g3 on chop: the
    // Save Principle doesn't need the g3 saved now.
    const game = deal({
      hands: [
        ["y1", "r5", "y1", "g4", "r4"],
        ["g1", "r2", "b4", "b5", "g3"],
        ["r2", "p3", "g4*", "r3", "p4"],
      ],
      stacks: { red: 0, yellow: 3, green: 2, blue: 3, purple: 1 },
      clueTokens: 2,
    });
    const blue = rankMoves(playerView(game.state, ALICE), 2).find(
      ({ action }) =>
        action.type === "clue" && action.target === BOB && action.clue.value === "blue",
    )!;
    expect(blue).toMatchObject({
      category: "mandated",
      reasons: [{}, { convention: "save-principle" }],
    });
  });

  it("make the receiver wait while the finesse position they see could connect", () => {
    const bob = privateKnowledge(playerView(reverse.state, BOB), read(reverse, BOB, 2));
    expect(names(bob[bobsRed]!)).toEqual(["r1", "r2"]);
    expect(top(reverse).action).not.toEqual(playOf(bobsRed));
  });

  it("have the finessed player blind-play, which tells the receiver their card", () => {
    const bobWaited = reverse.discard(4);
    expect(top(bobWaited)).toMatchObject({
      action: playOf(reverse.cardAt(0, CATHY)),
      category: "mandated",
      reasons: [{ convention: "finesse" }],
    });
    const cathyPlayed = bobWaited.play(0);
    const bob = privateKnowledge(playerView(cathyPlayed.state, BOB), read(cathyPlayed, BOB, 2));
    expect(names(bob[bobsRed]!)).toEqual(["r2"]);
  });

  it("are ruled out when the finessed player does something else", () => {
    // level-2#the-reverse-finesse, second example: Bob's red card is the r1, so Cathy, who sees
    // it, doesn't blind-play, and then Bob knows his card.
    const direct = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "y4"],
        ["g4", "b4", "r1", "p4", "y5"],
        ["r1", "g2", "b2", "p2", "y2"],
      ],
      clueTokens: 6,
    }).clue(BOB, "red");
    const red = direct.cardAt(2, BOB);
    const bobWaited = direct.discard(4);
    expect(top(bobWaited).action).not.toEqual(playOf(direct.cardAt(0, CATHY)));
    const cathyDiscarded = bobWaited.discard(4).discard(4);
    const bob = privateKnowledge(
      playerView(cathyDiscarded.state, BOB),
      read(cathyDiscarded, BOB, 2),
    );
    expect(names(bob[red]!)).toEqual(["r1"]);
    expect(playing(cathyDiscarded, red).reasons[0]!.text).toBe("The card is known to be playable.");
  });
});

describe("self-finesses (level 2)", () => {
  /** How `seat` would judge the clue `value` to `target`, at `level`. */
  const judging = (game: ReturnType<typeof deal>, target: number, value: number, level = 2) =>
    rankMoves(playerView(game.state, game.state.currentPlayer), level).find(
      ({ action }) =>
        action.type === "clue" && action.target === target && action.clue.value === value,
    )!;

  // level-2#the-self-finesse: every 1 is played, and Alice's 3 clue touches Cathy's r3. Nobody else
  // has a 2 on their finesse position, so Cathy's finesse position must be one.
  const beforeClue = deal({
    hands: [
      ["g4", "b4", "y4", "p4", "g5"],
      ["y4", "b5", "y5", "p5", "r4"],
      ["r2", "r3", "g4", "p4", "b4"],
    ],
    stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
    clueTokens: 6,
  });
  const selfFinesse = beforeClue.clue(CATHY, 3);
  const cathysThree = selfFinesse.cardAt(1, CATHY);

  it("are a permitted clue at level 2, and a misread at level 1", () => {
    expect(judging(beforeClue, CATHY, 3)).toMatchObject({
      category: "permitted",
      reasons: [{ convention: "self-finesse" }],
    });
    expect(judging(beforeClue, CATHY, 3, 1).category).toBe("violates");
  });

  it("have the receiver blind-play their finesse position when nothing else fits", () => {
    // Bob sees the r2 on Cathy's finesse position: it's her finesse, not his.
    expect(top(selfFinesse).action).not.toEqual(playOf(selfFinesse.cardAt(0, BOB)));
    const bobDiscarded = selfFinesse.discard(4);
    expect(top(bobDiscarded)).toMatchObject({
      action: playOf(selfFinesse.cardAt(0, CATHY)),
      category: "mandated",
      reasons: [{ convention: "finesse" }],
    });
    // The 2 plays as the r2, so her 3 is the r3.
    const cathyPlayed = bobDiscarded.play(0);
    const cathy = privateKnowledge(
      playerView(cathyPlayed.state, CATHY),
      read(cathyPlayed, CATHY, 2),
    );
    expect(names(cathy[cathysThree]!)).toEqual(["r3"]);
  });

  it("come after finesses on other players", () => {
    // Bob has the y2 on his finesse position, so Cathy waits to see whether he blind-plays it.
    const bobHasTwoBefore = deal({
      hands: [
        ["g4", "b4", "y4", "p4", "g5"],
        ["y2", "b5", "y5", "p5", "r4"],
        ["r2", "r3", "g4", "p4", "b4"],
      ],
      stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
      clueTokens: 6,
    });
    // Move ranking judges Cathy's reading as of the clue, so Alice's clue counts as a misread.
    expect(judging(bobHasTwoBefore, CATHY, 3).category).toBe("violates");
    const bobHasTwo = bobHasTwoBefore.clue(CATHY, 3);
    const cathy = (game: ReturnType<typeof deal>) =>
      privateKnowledge(playerView(game.state, CATHY), read(game, CATHY, 2));
    expect(names(cathy(bobHasTwo)[cathysThree]!)).toEqual(["y3"]);
    // Bob doesn't blind-play, so the finesse is hers.
    const bobDiscarded = bobHasTwo.discard(4);
    expect(names(cathy(bobDiscarded)[cathysThree]!)).toEqual(["r3", "y3", "g3", "b3", "p3"]);
    expect(top(bobDiscarded)).toMatchObject({
      action: playOf(bobHasTwo.cardAt(0, CATHY)),
      category: "mandated",
    });
  });

  it("are not read for a card another player's clued card could be", () => {
    // Bob's clued 2 could be any 2 (and plays anyway), so Cathy is never finessed for one.
    const prompted = deal({
      hands: [
        ["g4", "b4", "y4", "p4", "g5"],
        ["y4", "b5", "y2*", "p5", "r4"],
        ["r2", "r3", "g4", "p4", "b4"],
      ],
      stacks: { red: 1, yellow: 1, green: 1, blue: 1, purple: 1 },
      clueTokens: 6,
    }).clue(CATHY, 3);
    const conventions = read(prompted, ALICE, 2).readings[0]!.interpretations.flatMap(
      (i) => i.conventions,
    );
    expect(conventions).toContain("delayed-play-clue");
    expect(conventions).not.toContain("self-finesse");
  });

  it("come after direct play clues", () => {
    // The y3 is playable, so Cathy reads the 3 clue as a play clue on it and plays her r3.
    const direct = deal({
      hands: [
        ["g4", "b4", "y4", "p4", "g5"],
        ["y4", "b5", "y5", "p5", "r4"],
        ["r2", "r3", "g4", "p4", "b4"],
      ],
      stacks: { red: 1, yellow: 2, green: 1, blue: 1, purple: 1 },
      clueTokens: 6,
    });
    expect(judging(direct, CATHY, 3)).toMatchObject({
      category: "violates",
      reasons: [
        {
          text: "Cluing number 3 to seat 2 would be read as the yellow 3, but the card is the red 3.",
        },
      ],
    });
  });
});
