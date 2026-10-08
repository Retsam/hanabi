import { playerView } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { history } from "./history";
import { forRandomGames } from "./testing/randomGames";

const ALICE = 0;
const BOB = 1;

describe("history", { timeout: 60_000 }, () => {
  it("rebuilds the table before every event", () => {
    const start = deal({
      hands: [
        ["r1", "r2", "r3", "r4", "r5"],
        ["y1", "y2", "y3", "y4", "y5"],
      ],
      stacks: { green: 2 },
      clueTokens: 7,
    });
    const [y1, y3, r5] = [start.cardAt(0, BOB), start.cardAt(2, BOB), start.cardAt(4, ALICE)];
    // Alice clues Bob's 1, Bob plays it, Alice discards r5, Bob misplays y3.
    const game = start.clue(BOB, 1).play(0).discard(4).play(2);
    const moments = history(playerView(game.state, ALICE));
    const name = (ids: readonly number[]) => ids.map((id) => game.name(id));

    // moments[t] is the table just before log[t], and the last one is the table now.
    expect(moments).toHaveLength(5);
    expect(moments[0]).toMatchObject({ stacks: { green: 2, yellow: 0 }, discardPile: [] });
    expect(moments[0]!.clues[y1]!.touchedBy).toEqual([]);
    // After the 1 clue: Bob's y1 is touched, and still in his hand.
    expect(moments[1]!.clues[y1]!.touchedBy).toEqual([{ kind: "rank", value: 1 }]);
    expect(name(moments[1]!.hands[BOB]!)).toEqual(["y1", "y2", "y3", "y4", "y5"]);
    // After Bob plays it: it is on the stack and he has drawn.
    expect(moments[2]!.stacks.yellow).toBe(1);
    expect(moments[2]!.hands[BOB]).not.toContain(y1);
    expect(moments[3]!.discardPile).toEqual([r5]);
    expect(moments[4]!.discardPile).toEqual([r5, y3]);
  });

  it("matches every state of random games, from any seat", () => {
    forRandomGames(5, ({ states, state }, seat) => {
      const moments = history(playerView(state, seat));
      expect(moments).toHaveLength(states.length);
      moments.forEach((moment, turn) => {
        const { hands, stacks, discardPile, cards } = states[turn]!;
        expect(moment).toEqual({ hands, stacks, discardPile, clues: cards.map((c) => c.clues) });
      });
    });
  });
});
