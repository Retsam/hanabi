import type { Clue } from "./actions";
import type { Card, CardId, Suit } from "./card";
import type { GameConfig } from "./config";
import { orderedDeck } from "./deck";

/** A player's position at the table, from 0 to `numPlayers - 1`. */
export type Seat = number;

/** The clues a card has been present for, split by whether the clue touched it. */
export interface ClueKnowledge {
  readonly touchedBy: readonly Clue[];
  readonly notTouchedBy: readonly Clue[];
}

export interface CardState {
  readonly id: CardId;
  readonly card: Card;
  readonly clues: ClueKnowledge;
}

export type Status = "playing" | "finalRound" | "over";

export interface GameState {
  readonly config: GameConfig;
  /** Every card in the game, indexed by `CardId`. */
  readonly cards: readonly CardState[];
  /** Each seat's hand, newest card first (hanab.live's slot 1 is index 0). */
  readonly hands: readonly (readonly CardId[])[];
  /** The draw pile, next card to be drawn first. */
  readonly drawPile: readonly CardId[];
  /** The discard pile, in the order cards were discarded or misplayed. */
  readonly discardPile: readonly CardId[];
  /** The highest rank played on each suit's stack, or 0 if none. */
  readonly stacks: Readonly<Record<Suit, number>>;
  readonly clueTokens: number;
  readonly strikes: number;
  readonly currentPlayer: Seat;
  /** Turns left once the draw pile is empty (status "finalRound"), otherwise null. */
  readonly turnsRemaining: number | null;
  /** How many actions have been applied so far. */
  readonly turn: number;
  readonly status: Status;
}

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
