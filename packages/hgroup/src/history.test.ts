import { playerView } from "@hanabi/engine";
import { deal, randomGame } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { history } from "./history";

const ALICE = 0;
const BOB = 1;

describe("history", () => {
  it("rebuilds the table before every event", () => {
    const game = deal({
      hands: [
        ["r1", "r2", "r3", "r4", "r5"],
        ["y1", "y2", "y3", "y4", "y5"],
      ],
      stacks: { green: 2 },
      clueTokens: 7,
    })
      .clue(BOB, 1)
      .play(0)
      .discard(4)
      .play(2);
    const moments = history(playerView(game.state, ALICE));
    expect(moments).toHaveLength(5);
    expect(moments[0]).toMatchObject({ stacks: { green: 2, yellow: 0 }, discardPile: [] });
    expect(moments[1]!.clues[game.cardAt(4, BOB)]!.touchedBy).toEqual([]);
    expect(moments[2]!.stacks.yellow).toBe(1);
    expect(moments[3]!.discardPile).toHaveLength(1);
    expect(moments[4]!.discardPile).toHaveLength(2);
  });

  it("matches every state of random games, from every seat", () => {
    for (let seed = 0; seed < 40; seed++) {
      const numPlayers = ([2, 3, 4, 5] as const)[seed % 4]!;
      const { states, state } = randomGame(numPlayers, seed);
      const moments = history(playerView(state, seed % numPlayers));
      expect(moments).toHaveLength(states.length);
      moments.forEach((moment, turn) => {
        const { hands, stacks, discardPile, cards } = states[turn]!;
        expect(moment).toEqual({ hands, stacks, discardPile, clues: cards.map((c) => c.clues) });
      });
    }
  });
});
