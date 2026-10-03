import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { describe, expect, it } from "vitest";
import { standardConfig } from "./config";
import { orderedDeck, shuffledDeck } from "./deck";
import type { Card } from "./card";

const sortKey = (card: Card) => `${card.suit} ${card.rank}`;
const sorted = (cards: readonly Card[]) => cards.map(sortKey).toSorted();

describe("orderedDeck", () => {
  it("has 50 cards: three 1s, two each of 2 to 4 and one 5 per suit", () => {
    const deck = orderedDeck(standardConfig(2));
    expect(deck).toHaveLength(50);
    const reds = deck.filter((card) => card.suit === "red").map((card) => card.rank);
    expect(reds).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });
});

describe("shuffledDeck", () => {
  const config = standardConfig(3);

  it("contains the same cards as the ordered deck", () => {
    expect(sorted(shuffledDeck(config, xoroshiro128plus(1)))).toEqual(sorted(orderedDeck(config)));
  });

  it("is deterministic for a seed and does not advance the generator", () => {
    const rng = xoroshiro128plus(42);
    const first = shuffledDeck(config, rng);
    expect(shuffledDeck(config, rng)).toEqual(first);
    expect(shuffledDeck(config, xoroshiro128plus(42))).toEqual(first);
  });

  it("differs between seeds", () => {
    expect(shuffledDeck(config, xoroshiro128plus(1))).not.toEqual(
      shuffledDeck(config, xoroshiro128plus(2)),
    );
  });
});
