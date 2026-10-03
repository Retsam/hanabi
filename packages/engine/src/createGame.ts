import { orderedDeck } from "./deck";
import type { Card, CardId, CardState, GameConfig, GameState, Suit } from "./types";

const cardKey = (card: Card) => `${card.suit} ${card.rank}`;

/**
 * Deals from `deck` and returns the initial state. Card ids are indices into `deck`. Like
 * hanab.live, each seat in turn is dealt its whole hand before the next seat.
 *
 * Throws if `deck` is not exactly the cards the config calls for.
 */
export function createGame(config: GameConfig, deck: readonly Card[]): GameState {
  assertDeckMatchesConfig(config, deck);

  const cards: CardState[] = deck.map((card, id) => ({
    id,
    card: { suit: card.suit, rank: card.rank },
    clues: { touchedBy: [], notTouchedBy: [] },
  }));

  const ids: CardId[] = cards.map((card) => card.id);
  const hands = Array.from({ length: config.numPlayers }, (_, seat) =>
    // Each new card goes to the front of the hand.
    ids.slice(seat * config.handSize, (seat + 1) * config.handSize).toReversed(),
  );
  const drawPile = ids.slice(config.numPlayers * config.handSize);

  const stacks: Record<Suit, number> = {};
  for (const suit of config.suits) stacks[suit] = 0;

  return {
    config,
    cards,
    hands,
    drawPile,
    discardPile: [],
    stacks,
    clueTokens: config.maxClueTokens,
    strikes: 0,
    currentPlayer: 0,
    turnsRemaining: null,
    turn: 0,
    status: "playing",
  };
}

function assertDeckMatchesConfig(config: GameConfig, deck: readonly Card[]): void {
  const expected = orderedDeck(config).map(cardKey).toSorted();
  const actual = deck.map(cardKey).toSorted();
  if (expected.length !== actual.length || expected.some((key, i) => key !== actual[i])) {
    throw new Error("Deck does not match the cards the config calls for");
  }
  if (config.numPlayers * config.handSize > deck.length) {
    throw new Error("Deck is too small to deal every hand");
  }
}
