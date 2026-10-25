import { hgroupSeat, runGame } from "@hanabi/ai";
import { createGame, shuffledDeck, standardConfig } from "@hanabi/engine";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { describe, expect, it } from "vitest";
import type { Category, RankedMove, TurnReview } from "@hanabi/hgroup";
import { reviewTurns, standing } from "./review.ts";

describe("reviewTurns", () => {
  it("lines up each move's review with the state, event and table it happened on", async () => {
    const config = standardConfig(3);
    const deck = shuffledDeck(config, xoroshiro128plus(4));
    const seats = Array.from({ length: 3 }, () => hgroupSeat(1));
    const { state, actions } = await runGame(createGame(config, deck), seats);

    const turns = reviewTurns({ config, deck, actions }, 1);

    expect(turns).toHaveLength(actions.length);
    for (const [i, { review, state: before, event, moment }] of turns.entries()) {
      expect(before.turn).toBe(i);
      expect(review.seat).toBe(before.currentPlayer);
      expect(review.move.action).toEqual(actions[i]);
      expect(event).toEqual(state.log[i]);
      expect(moment.hands).toEqual(before.hands);
      // Self-play takes the top move, so every move ranks first.
      expect(review.rank).toBe(1);
    }
  });
});

const ranked = (category: Category): RankedMove => ({
  action: { type: "discard", cardId: 0 },
  category,
  score: 0,
  reasons: [],
});
const turn = (category: Category, rank: number, top: Category): TurnReview => ({
  turn: 0,
  seat: 0,
  move: ranked(category),
  rank,
  moves: 3,
  alternative: ranked(top),
});

describe("standing", () => {
  it("compares the move with the engine's top pick", () => {
    expect(standing(turn("permitted", 1, "permitted"))).toBe("best");
    expect(standing(turn("violates", 1, "violates"))).toBe("forced");
    expect(standing(turn("permitted", 2, "permitted"))).toBe("close");
    expect(standing(turn("violates", 3, "violates"))).toBe("close");
    expect(standing(turn("permitted", 2, "mandated"))).toBe("worse");
  });
});
