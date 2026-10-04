// A stacked-deck scenario builder for tests: deal exact hands, then step through actions by slot.
import { produce } from "immer";
import { type Action, apply, type Clue, type GameEvent } from "../actions";
import { type Card, type CardId, RANKS, type Rank, type Suit } from "../card";
import { type GameConfig, standardConfig } from "../config";
import { orderedDeck } from "../deck";
import { createGame, finalRound, type GameState, type Seat } from "../state";

/** Short card notation, like "r1" for a red 1: the suit's first letter, then the rank. */
export type CardName = string;

export interface ScenarioSetup {
  /** Each seat's hand, newest card (slot 1) first. Their number sets the player count. */
  readonly hands: readonly (readonly CardName[])[];
  /**
   * The draw pile, next card first. When given, it is the whole draw pile and every card not
   * named anywhere is put in the discard pile. When omitted, the rest of the deck is drawn in
   * suit then rank order.
   */
  readonly drawPile?: readonly CardName[];
  /** How high each suit's stack starts. The cards on the stacks are taken out of the deck. */
  readonly stacks?: Readonly<Record<Suit, number>>;
  readonly clueTokens?: number;
  readonly strikes?: number;
}

export function parseCard(config: GameConfig, name: CardName): Card {
  const suit = config.suits.find((s) => s[0] === name[0]);
  const rank = RANKS.find((r) => r === Number(name.slice(1)));
  if (suit === undefined || rank === undefined) throw new Error(`Bad card name ${name}`);
  return { suit, rank };
}

/** Starts a game whose hands, draw pile and stacks are exactly as described. */
export function deal(setup: ScenarioSetup): Scenario {
  const players = setup.hands.length;
  if (players !== 2 && players !== 3 && players !== 4 && players !== 5) {
    throw new Error("Deal 2 to 5 hands");
  }
  const config = standardConfig(players);

  const remaining = orderedDeck(config);
  const take = (card: Card): Card => {
    const i = remaining.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
    if (i === -1) throw new Error(`No ${card.suit[0]}${card.rank} left in the deck`);
    return remaining.splice(i, 1)[0]!;
  };

  const stacks = Object.entries(setup.stacks ?? {});
  const played = stacks.flatMap(([suit, height]) => {
    if (!config.suits.includes(suit)) throw new Error(`Unknown suit ${suit}`);
    return RANKS.filter((rank) => rank <= height).map((rank) => take({ suit, rank }));
  });
  // createGame deals each hand oldest card first, so reverse each hand into the deck.
  const dealt = setup.hands.flatMap((hand) => {
    if (hand.length !== config.handSize) throw new Error(`Hands need ${config.handSize} cards`);
    return hand.toReversed().map((name) => take(parseCard(config, name)));
  });
  const drawn = (setup.drawPile ?? []).map((name) => take(parseCard(config, name)));
  const unnamed = remaining.length;
  const deck = [...dealt, ...drawn, ...remaining, ...played];

  const state = produce(createGame(config, deck), (draft) => {
    // The played cards come off the bottom of the draw pile onto the stacks.
    draft.drawPile.splice(draft.drawPile.length - played.length);
    for (const [suit, height] of stacks) draft.stacks[suit] = height;
    // With a draw pile given, the unnamed cards go from the bottom of it to the discard pile.
    if (setup.drawPile !== undefined) {
      draft.discardPile.push(...draft.drawPile.splice(draft.drawPile.length - unnamed));
      if (draft.drawPile.length === 0) Object.assign(draft, finalRound(config));
    }
    if (setup.clueTokens !== undefined) draft.clueTokens = setup.clueTokens;
    if (setup.strikes !== undefined) draft.strikes = setup.strikes;
  });
  return new Scenario(state, [], []);
}

/** An immutable game in progress. Each action returns a new Scenario. */
export class Scenario {
  constructor(
    readonly state: GameState,
    /** Every action applied so far, oldest first. */
    readonly actions: readonly Action[],
    /** The event each action produced. */
    readonly events: readonly GameEvent[],
  ) {}

  /** The most recent event. */
  get event(): GameEvent {
    const event = this.events.at(-1);
    if (event === undefined) throw new Error("No actions applied yet");
    return event;
  }

  /** The id of the card in `slot` (0 is the newest) of `seat`'s hand, the current player's by default. */
  cardAt(slot: number, seat: Seat = this.state.currentPlayer): CardId {
    const id = this.state.hands[seat]?.[slot];
    if (id === undefined) throw new Error(`Seat ${seat} has no slot ${slot}`);
    return id;
  }

  /** Each seat's hand as card names, newest first. */
  get hands(): CardName[][] {
    return this.state.hands.map((hand) => hand.map((id) => this.name(id)));
  }

  name(id: CardId): CardName {
    const { card } = this.state.cards[id]!;
    return `${card.suit[0]}${card.rank}`;
  }

  do(action: Action): Scenario {
    const { state, event } = apply(this.state, action);
    return new Scenario(state, [...this.actions, action], [...this.events, event]);
  }

  /** The current player plays the card in `slot`. */
  play(slot: number): Scenario {
    return this.do({ type: "play", cardId: this.cardAt(slot) });
  }

  /** The current player discards the card in `slot`. */
  discard(slot: number): Scenario {
    return this.do({ type: "discard", cardId: this.cardAt(slot) });
  }

  /** The current player clues `target` with a suit (a string) or a rank (a number). */
  clue(target: Seat, value: Suit | Rank): Scenario {
    const clue: Clue =
      typeof value === "number" ? { kind: "rank", value } : { kind: "color", value };
    return this.do({ type: "clue", target, clue });
  }
}
