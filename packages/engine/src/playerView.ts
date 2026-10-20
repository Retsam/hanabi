// The projection of game state one seat is allowed to see. See docs/ARCHITECTURE.md ("Hidden information").
import type { Card, CardId } from "./card.ts";
import type { ClueKnowledge, GameState, Seat } from "./state.ts";

/** A card as one seat sees it: `card` is null when its identity is hidden from that seat. */
export interface CardView {
  readonly id: CardId;
  readonly card: Card | null;
  readonly clues: ClueKnowledge;
}

/**
 * Everything one seat may know about the game. Other players' cards are visible; the viewer's own
 * cards and the draw pile have their identity hidden. Clue knowledge is visible for every card.
 */
export interface PlayerView extends Omit<GameState, "cards" | "drawPile"> {
  /** The seat this view belongs to. */
  readonly seat: Seat;
  /** Every card in the game, indexed by `CardId`. */
  readonly cards: readonly CardView[];
  readonly drawPileSize: number;
}

/** Projects `state` down to what `seat` is allowed to see. Throws if `seat` is not at the table. */
export function playerView(state: GameState, seat: Seat): PlayerView {
  const ownHand = state.hands[seat];
  if (!Number.isInteger(seat) || ownHand === undefined) {
    throw new Error(`Seat ${seat} is not at the table`);
  }
  const hidden = new Set<CardId>([...ownHand, ...state.drawPile]);
  const { cards, drawPile, ...rest } = state;

  return {
    ...rest,
    seat,
    cards: cards.map(({ id, card, clues }) => ({
      id,
      card: hidden.has(id) ? null : card,
      clues,
    })),
    drawPileSize: drawPile.length,
  };
}
