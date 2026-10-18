import { type Action, type GameEvent, type PlayerView, playerView } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { runGame } from "./runner";
import { hgroupSeat, type SeatController, syncSeat } from "./seat";

const ALICE = 0;
const BOB = 1;

// One card left to draw: the game ends a round after it is drawn.
const endgame = deal({
  hands: [
    ["r1", "y1", "g1", "b1", "p1"],
    ["r2", "y2", "g2", "b2", "p2"],
  ],
  drawPile: ["r3"],
  clueTokens: 0,
});

/** A seat that plays its newest card every turn and records what it saw. */
const recordingSeat = () => {
  const seen: { event: GameEvent; view: PlayerView }[] = [];
  const seat: SeatController = {
    ...syncSeat((view) => ({ type: "play", cardId: view.hands[view.seat]![0]! })),
    observe: (event, view) => seen.push({ event, view }),
  };
  return { seat, seen };
};

describe("runGame", () => {
  it("plays until the game is over, recording each action", async () => {
    const alice = recordingSeat();
    const bob = recordingSeat();
    const { state, actions } = await runGame(endgame.state, [alice.seat, bob.seat]);
    expect(state.status).toBe("over");
    // Alice draws the last card, then each seat has one more turn: Alice plays the card she drew.
    expect(actions).toEqual([
      { type: "play", cardId: endgame.cardAt(0, ALICE) },
      { type: "play", cardId: endgame.cardAt(0, BOB) },
      { type: "play", cardId: endgame.state.drawPile[0] },
    ]);
    expect(state.log).toHaveLength(3);
  });

  it("shows every seat each event in its own view", async () => {
    const alice = recordingSeat();
    const bob = recordingSeat();
    const { state } = await runGame(endgame.state, [alice.seat, bob.seat]);
    for (const [seat, { seen }] of [alice, bob].entries()) {
      expect(seen.map(({ event }) => event)).toEqual(state.log);
      for (const { view } of seen) {
        expect(view.seat).toBe(seat);
        expect(view.hands[seat]!.every((id) => view.cards[id]!.card === null)).toBe(true);
      }
    }
  });

  it("passes each event and the state after it to onEvent", async () => {
    const seen: number[] = [];
    const seat = recordingSeat().seat;
    await runGame(endgame.state, [seat, seat], (event, state) => {
      expect(state.log.at(-1)).toBe(event);
      seen.push(state.turn);
    });
    expect(seen).toEqual([1, 2, 3]);
  });

  it("throws when a seat chooses an illegal action", async () => {
    const discard: Action = { type: "discard", cardId: endgame.cardAt(0, BOB) };
    const seat = syncSeat(() => discard);
    await expect(runGame(endgame.state, [seat, seat])).rejects.toThrow(
      /Seat 0 chose an illegal action on turn 0/,
    );
  });

  it("throws when the seats don't match the player count", async () => {
    await expect(runGame(endgame.state, [recordingSeat().seat])).rejects.toThrow(
      "Got 1 seats for 2 players",
    );
  });
});

describe("hgroupSeat", () => {
  it("plays the decision engine's top move", async () => {
    // Alice's 1 clue on Bob's slot 1 is a play clue: Bob should play it.
    const game = deal({
      hands: [
        ["y3", "g3", "b3", "p3", "r4"],
        ["r1", "y4", "g4", "b4", "p4"],
      ],
    }).clue(BOB, 1);
    const action = await hgroupSeat(1).chooseAction(playerView(game.state, BOB));
    expect(action).toEqual({ type: "play", cardId: game.cardAt(0, BOB) });
  });
});
