import { describe, expect, it } from "vitest";
import { playerView } from "./playerView.ts";
import { history } from "./table.ts";
import { deal } from "./testing/scenario.ts";

const ALICE = 0;
const BOB = 1;

describe("history", () => {
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
    // The clue spends a token and the discard gets it back; the misplay leaves them alone.
    expect(moments.map((moment) => moment.clueTokens)).toEqual([7, 6, 6, 7, 7]);
  });

  it("gives a token back for a 5 unless the tokens are full", () => {
    const start = deal({
      hands: [
        ["r5", "y5", "g1", "b1", "p1"],
        ["r1", "y1", "g2", "b2", "p2"],
      ],
      stacks: { red: 4, yellow: 4 },
      clueTokens: 7,
    });
    // Alice plays r5, Bob misplays r1, Alice plays y5 (her second card now that she has drawn).
    const game = start.play(0).play(0).play(1);
    expect(game.state.stacks).toMatchObject({ red: 5, yellow: 5 });
    expect(history(game.state).map((moment) => moment.clueTokens)).toEqual([7, 8, 8, 8]);
  });

  it("starts from a scenario's setup, with its clued and discarded cards", () => {
    const game = deal({
      hands: [
        ["r1", "r2", "r3", "r4", "r5*"],
        ["y1", "y2", "y3", "y4", "y5"],
      ],
      discardPile: ["b4"],
    }).clue(BOB, 1);
    const [opening] = history(game.state);
    expect(opening!.discardPile.map((id) => game.name(id))).toEqual(["b4"]);
    expect(opening!.clues[game.cardAt(4, ALICE)]!.touchedBy).toEqual([{ kind: "rank", value: 5 }]);
  });
});
