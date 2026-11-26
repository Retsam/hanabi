import { standardConfig } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { reviewGame } from "@hanabi/hgroup";
import { type GameResult, selfPlay, summarize } from "./simulate.ts";

const { state } = deal({
  hands: [
    ["r1", "y1", "g1", "b1", "p1"],
    ["r2", "y2", "g2", "b2", "p2"],
  ],
});

const result = (seed: number, score: number, strikes: number): GameResult => ({
  seed,
  score,
  strikes,
  struckOut: strikes === 3,
  replay: { config: standardConfig(2), deck: [], actions: [] },
  state,
});

describe("summarize", () => {
  it("averages scores and strikes and counts perfect and struck-out games", () => {
    const summary = summarize([
      result(1, 25, 0),
      result(2, 0, 3),
      result(3, 20, 1),
      result(4, 0, 2),
    ]);
    expect(summary).toMatchObject({
      games: 4,
      meanScore: 11.25,
      perfect: 1,
      struckOut: 1,
      meanStrikes: 1.5,
    });
  });

  it("picks the first lowest-scoring game as the worst", () => {
    expect(summarize([result(1, 18, 0), result(2, 12, 1), result(3, 12, 0)]).worst.seed).toBe(2);
  });

  it("throws on an empty batch", () => {
    expect(() => summarize([])).toThrow("No games to summarize");
  });
});

describe("selfPlay", () => {
  it("plays the top-ranked move on every turn, as a review of the game shows", async () => {
    const { replay } = await selfPlay(2, 1, 1);
    const reviews = reviewGame(replay, 1);
    expect(reviews).toHaveLength(replay.actions.length);
    expect(reviews.every((review) => review.rank === 1)).toBe(true);
  });
});

describe("selfPlay with mistakes", () => {
  it("sometimes plays a lower-ranked move, and a seed still reproduces the game", async () => {
    const { replay } = await selfPlay(3, 1, 1, {}, { rate: 0.3 });
    const ranks = reviewGame(replay, 1).map((review) => review.rank);
    expect(ranks.some((rank) => rank > 1)).toBe(true);
    const again = await selfPlay(3, 1, 1, {}, { rate: 0.3 });
    expect(again.replay.actions).toEqual(replay.actions);
  });

  it("plays like plain self-play at a rate of 0", async () => {
    const plain = await selfPlay(3, 1, 1);
    const none = await selfPlay(3, 1, 1, {}, { rate: 0 });
    expect(none.replay.actions).toEqual(plain.replay.actions);
  });
});
