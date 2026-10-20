import { standardConfig } from "@hanabi/engine";
import { deal } from "@hanabi/engine/testing";
import { describe, expect, it } from "vitest";
import { type GameResult, summarize } from "./simulate.ts";

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
