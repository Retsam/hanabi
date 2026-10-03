// Actions and the events `apply` returns. See docs/ARCHITECTURE.md ("Actions", "Events").
import { produce } from "immer";
import { type Card, type CardId, RANKS, type Rank, type Suit } from "./card";
import type { GameState, Seat } from "./state";

export type Clue =
  | { readonly kind: "color"; readonly value: Suit }
  | { readonly kind: "rank"; readonly value: Rank };

/** Actions never name the acting player (it is always `currentPlayer`) and reference cards by id. */
export type Action =
  | { readonly type: "play"; readonly cardId: CardId }
  | { readonly type: "discard"; readonly cardId: CardId }
  | { readonly type: "clue"; readonly target: Seat; readonly clue: Clue };

/** What an action revealed, returned by `apply` alongside the new state. */
export type GameEvent =
  | {
      readonly type: "play";
      readonly seat: Seat;
      readonly cardId: CardId;
      readonly card: Card;
      readonly success: boolean;
      /** The card drawn to replace it, or null if the draw pile was empty. */
      readonly drawn: CardId | null;
    }
  | {
      readonly type: "discard";
      readonly seat: Seat;
      readonly cardId: CardId;
      readonly card: Card;
      readonly drawn: CardId | null;
    }
  | {
      readonly type: "clue";
      readonly seat: Seat;
      readonly target: Seat;
      readonly clue: Clue;
      readonly touched: readonly CardId[];
    };

/** Whether `clue` touches `card`. */
export function clueTouches(clue: Clue, card: Card): boolean {
  return clue.kind === "color" ? card.suit === clue.value : card.rank === clue.value;
}

/** Returns null if `action` is legal for the current player, otherwise why it is not. */
export function validate(state: GameState, action: Action): string | null {
  if (state.status === "over") return "The game is over";
  const hand = currentHand(state);
  if (action.type === "play") {
    return hand.includes(action.cardId) ? null : `Card ${action.cardId} is not in your hand`;
  }
  if (action.type === "discard") {
    if (!hand.includes(action.cardId)) return `Card ${action.cardId} is not in your hand`;
    if (state.clueTokens >= state.config.maxClueTokens) {
      return "Cannot discard with full clue tokens";
    }
    return null;
  }

  if (state.clueTokens <= 0) return "No clue tokens left";
  const { target, clue } = action;
  if (!Number.isInteger(target) || target < 0 || target >= state.config.numPlayers) {
    return `There is no seat ${target}`;
  }
  if (target === state.currentPlayer) return "Cannot clue yourself";
  const known =
    clue.kind === "color" ? state.config.suits.includes(clue.value) : RANKS.includes(clue.value);
  if (!known) return `Unknown ${clue.kind} ${clue.value}`;
  if (!handOf(state, target).some((id) => clueTouches(clue, cardOf(state, id)))) {
    return "A clue must touch at least one card";
  }
  return null;
}

/** Applies a legal action and returns the new state and what happened. Throws if it is illegal. */
export function apply(state: GameState, action: Action): { state: GameState; event: GameEvent } {
  const reason = validate(state, action);
  if (reason !== null) throw new Error(`Illegal action: ${reason}`);

  const seat = state.currentPlayer;
  let event!: GameEvent;
  const next = produce(state, (draft) => {
    const hand = draft.hands[seat]!;
    const removeAndDraw = (cardId: CardId): CardId | null => {
      hand.splice(hand.indexOf(cardId), 1);
      const drawn = draft.drawPile.shift() ?? null;
      if (drawn !== null) {
        hand.unshift(drawn);
      }
      return drawn;
    };

    switch (action.type) {
      case "play": {
        const card = cardOf(state, action.cardId);
        const success = state.stacks[card.suit] === card.rank - 1;
        if (success) {
          draft.stacks[card.suit] = card.rank;
          if (card.rank === MAX_RANK && draft.clueTokens < state.config.maxClueTokens) {
            draft.clueTokens++;
          }
        } else {
          draft.strikes++;
          draft.discardPile.push(action.cardId);
        }
        const drawn = removeAndDraw(action.cardId);
        event = { type: "play", seat, cardId: action.cardId, card, success, drawn };
        break;
      }
      case "discard": {
        const card = cardOf(state, action.cardId);
        draft.clueTokens++;
        draft.discardPile.push(action.cardId);
        const drawn = removeAndDraw(action.cardId);
        event = { type: "discard", seat, cardId: action.cardId, card, drawn };
        break;
      }
      case "clue": {
        const { target, clue } = action;
        draft.clueTokens--;
        const touched: CardId[] = [];
        for (const id of draft.hands[target]!) {
          const cardState = draft.cards[id]!;
          if (clueTouches(clue, cardState.card)) {
            cardState.clues.touchedBy.push(clue);
            touched.push(id);
          } else {
            cardState.clues.notTouchedBy.push(clue);
          }
        }
        event = { type: "clue", seat, target, clue, touched };
        break;
      }
    }

    draft.turn++;
    draft.currentPlayer = (seat + 1) % state.config.numPlayers;
    if (draft.turnsRemaining !== null) draft.turnsRemaining--;
    if (state.drawPile.length > 0 && draft.drawPile.length === 0) {
      // Everyone, including the player who drew the last card, gets one more turn.
      draft.status = "finalRound";
      draft.turnsRemaining = state.config.numPlayers;
    }

    if (
      draft.strikes >= state.config.maxStrikes ||
      draft.turnsRemaining === 0 ||
      state.config.suits.every((suit) => draft.stacks[suit] === MAX_RANK)
    ) {
      draft.status = "over";
    }
  });
  return { state: next, event };
}

/** Every legal action for the current player. Empty once the game is over. */
export function legalActions(state: GameState): Action[] {
  if (state.status === "over") return [];
  const actions: Action[] = [];
  const hand = currentHand(state);
  for (const cardId of hand) actions.push({ type: "play", cardId });
  if (state.clueTokens < state.config.maxClueTokens) {
    for (const cardId of hand) actions.push({ type: "discard", cardId });
  }
  if (state.clueTokens > 0) {
    const clues: Clue[] = [
      ...state.config.suits.map((value) => ({ kind: "color", value }) as const),
      ...RANKS.map((value) => ({ kind: "rank", value }) as const),
    ];
    for (let target = 0; target < state.config.numPlayers; target++) {
      if (target === state.currentPlayer) continue;
      const cards = handOf(state, target).map((id) => cardOf(state, id));
      for (const clue of clues) {
        if (cards.some((card) => clueTouches(clue, card))) {
          actions.push({ type: "clue", target, clue });
        }
      }
    }
  }
  return actions;
}

const MAX_RANK = RANKS.at(-1)!;

const handOf = (state: GameState, seat: Seat) => state.hands[seat]!;
const currentHand = (state: GameState) => handOf(state, state.currentPlayer);
const cardOf = (state: GameState, id: CardId) => state.cards[id]!.card;
