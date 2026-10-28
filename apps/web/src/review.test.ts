import { hgroupSeat, runGame } from "@hanabi/ai";
import { createGame, shuffledDeck, standardConfig } from "@hanabi/engine";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { describe, expect, it } from "vitest";
import { type Category, MAX_LEVEL, type RankedMove, type TurnReview } from "@hanabi/hgroup";
import { reviewTurns, standing } from "./review.ts";

async function selfPlay(level: number, numPlayers: 2 | 3 | 4 | 5 = 3, seed = 4) {
  const config = standardConfig(numPlayers);
  const deck = shuffledDeck(config, xoroshiro128plus(seed));
  const seats = Array.from({ length: numPlayers }, () => hgroupSeat(level));
  const { state, actions } = await runGame(createGame(config, deck), seats);
  return { state, record: { config, deck, actions } };
}

describe("reviewTurns", () => {
  it("lines up each move's review with the state, event and table it happened on", async () => {
    const { state, record } = await selfPlay(1);
    const { actions } = record;

    const turns = reviewTurns(record, 1);

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

  it("previews the next level's pick where it beats this level's", async () => {
    // A game where level 2's multi-prompt reads clues differently.
    const { record } = await selfPlay(1, 5, 1);

    const previews = reviewTurns(record, 1).flatMap(({ review, preview }) =>
      preview === undefined ? [] : [{ review, preview }],
    );

    expect(previews.length).toBeGreaterThan(0);
    for (const { review, preview } of previews) {
      expect(preview.level).toBe(2);
      // Self-play took level 1's top move, so level 2's differing pick ranks below it there.
      expect(preview.move.action).not.toEqual(review.move.action);
      expect(preview.move.reasons.map((reason) => reason.convention)).toContain("multi-prompt");
      expect(preview.rank).toBeGreaterThan(1);
    }
  });

  it("has nothing to preview at the highest level", async () => {
    const { record } = await selfPlay(MAX_LEVEL);

    expect(reviewTurns(record, MAX_LEVEL).filter((turn) => turn.preview)).toEqual([]);
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
