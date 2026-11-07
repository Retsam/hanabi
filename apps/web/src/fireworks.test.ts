import { describe, expect, it } from "vitest";
import { newShow, showOver, step } from "./fireworks.ts";

const COLORS = ["red", "blue"];

/** Steps `show` at 60 fps for `seconds`. */
function run(show: ReturnType<typeof newShow>, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) step(show, 1 / 60);
}

describe("fireworks", () => {
  it("launches rockets from the bottom that climb", () => {
    const show = newShow(800, 600, COLORS);
    step(show, 1 / 60);
    expect(show.rockets).toHaveLength(1);
    const [rocket] = show.rockets;
    expect(rocket?.y).toBeLessThan(600);
    expect(COLORS).toContain(rocket?.color);
  });

  it("bursts rockets into sparks in the upper part of the screen", () => {
    const show = newShow(800, 600, COLORS);
    run(show, 2);
    expect(show.sparks.length).toBeGreaterThan(0);
    for (const spark of show.sparks) expect(spark.y).toBeLessThan(600);
  });

  it("ends once launching stops and the last sparks fade", () => {
    const show = newShow(800, 600, COLORS, 1);
    run(show, 1);
    expect(showOver(show)).toBe(false);
    run(show, 5);
    expect(showOver(show)).toBe(true);
  });
});
