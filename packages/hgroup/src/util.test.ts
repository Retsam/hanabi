import { describe, expect, it } from "vitest";
import { uniqBy } from "./util.ts";

describe("uniqBy", () => {
  it("keeps the first of each repeated item, by identity by default", () => {
    expect(uniqBy([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });

  it("compares with the given function", () => {
    const cards = [{ rank: 1 }, { rank: 2 }, { rank: 1 }];
    expect(uniqBy(cards, (a, b) => a.rank === b.rank)).toEqual([{ rank: 1 }, { rank: 2 }]);
  });
});
