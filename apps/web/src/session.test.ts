import { type Action, playerView, type Replay, replay } from "@hanabi/engine";
import { rankMoves } from "@hanabi/hgroup";
import { describe, expect, it } from "vitest";
import { humanSeat, type Snapshot, startSession } from "./session.ts";

const ALICE = 0;
const BOB = 1;

const options = { numPlayers: 3, seed: 7, level: 1, humanSeat: BOB, aiDelayMs: 0 } as const;

/**
 * Plays a game, the human taking the engine's top move, until `done` holds for a snapshot (by
 * default, until the game is over), and resolves with that snapshot.
 */
function playUntil(
  done: (snapshot: Snapshot) => boolean = ({ view }) => view.status === "over",
  record?: Replay,
): Promise<Snapshot> {
  return new Promise((resolve) => {
    let finished = false;
    const session = startSession(
      options,
      (snapshot) => {
        if (finished) return;
        if (done(snapshot)) {
          finished = true;
          // The first update comes before `startSession` returns `session`.
          setTimeout(() => session.stop());
          return resolve(snapshot);
        }
        const { view } = snapshot;
        if (view.currentPlayer !== BOB || view.status === "over") return;
        // Move after the update returns, as a click would.
        setTimeout(() => expect(session.submit(rankMoves(view, 1)[0]!.action)).toBeNull());
      },
      record,
    );
  });
}

describe("startSession", () => {
  it("plays a game to the end and gives its replay", async () => {
    const { view, record } = await playUntil();
    expect(view.status).toBe("over");
    expect(view.seat).toBe(BOB);
    expect(replay(record).state.log).toEqual(view.log);
  });

  it("gives the record so far after every move", async () => {
    const seen: Snapshot[] = [];
    await playUntil((snapshot) => seen.push(snapshot) > 5);
    for (const [turn, { view, record }] of seen.entries()) {
      expect(record.actions).toHaveLength(turn);
      expect(playerView(replay(record).state, BOB)).toEqual(view);
    }
  });

  it("resumes a saved record and plays on to the same end", async () => {
    const whole = await playUntil();
    const partway = await playUntil(({ record }) => record.actions.length === 10);
    const resumed = await playUntil(undefined, partway.record);
    expect(resumed.record).toEqual(whole.record);
  });

  it("throws when a saved record does not replay", async () => {
    const { record } = await playUntil(() => true);
    // Card 0 is dealt to Alice, and nobody can discard at full clue tokens.
    const bad = { ...record, actions: [{ type: "discard", cardId: 0 } as const] };
    expect(() => startSession(options, () => {}, bad)).toThrow(/turn 0/);
  });

  it("only ever shows the human's view", async () => {
    const seen: Snapshot[] = [];
    await new Promise<void>((resolve) => {
      const session = startSession(options, (snapshot) => {
        seen.push(snapshot);
        if (snapshot.view.currentPlayer === BOB) {
          session.stop();
          resolve();
        }
      });
    });
    for (const { view } of seen) {
      expect(view.seat).toBe(BOB);
      for (const id of view.hands[BOB]!) expect(view.cards[id]!.card).toBeNull();
    }
  });

  it("refuses moves out of turn and illegal moves", () => {
    const session = startSession({ ...options, humanSeat: ALICE }, () => {});
    // Card 0 is dealt to Alice.
    expect(session.submit({ type: "discard", cardId: 0 })).toMatch(/full clue tokens/);
    session.stop();
    const late = startSession({ ...options, humanSeat: BOB }, () => {});
    expect(late.submit({ type: "play", cardId: 0 })).toBe("It is not your turn");
    late.stop();
  });
});

describe("humanSeat", () => {
  it("resolves the pending move with the submitted action", async () => {
    const seat = humanSeat();
    const move: Action = { type: "play", cardId: 3 };
    const chosen = seat.controller.chooseAction(null!);
    seat.submit(move);
    await expect(chosen).resolves.toBe(move);
  });

  it("throws when no move is being asked for", () => {
    expect(() => humanSeat().submit({ type: "play", cardId: 3 })).toThrow(/not being asked/);
  });
});
