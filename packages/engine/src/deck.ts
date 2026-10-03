import { uniformInt } from "pure-rand/distribution/uniformInt";
import type { RandomGenerator } from "pure-rand/types/RandomGenerator";
import { type Card, RANKS } from "./card";
import type { GameConfig } from "./config";

/** Every card the config calls for, in suit then rank order. */
export function orderedDeck(config: GameConfig): Card[] {
  return config.suits.flatMap((suit) =>
    RANKS.flatMap((rank) =>
      Array.from({ length: config.rankCounts[rank] }, () => ({ suit, rank })),
    ),
  );
}

/**
 * A shuffled deck for the config. `rng` is not advanced: the same generator always gives the same
 * deck.
 */
export function shuffledDeck(config: GameConfig, rng: RandomGenerator): Card[] {
  const random = rng.clone();
  const deck = orderedDeck(config);
  // Fisher-Yates.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = uniformInt(random, 0, i);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}
