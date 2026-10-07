// The public table at every turn so far, rebuilt from a view's event log. See docs/ARCHITECTURE.md
// ("Knowledge model").
import type { CardId, ClueKnowledge, PlayerView, Suit } from "@hanabi/engine";

/** The public parts of the table at one moment: what every player could see of it. */
export interface Moment {
  /** Each seat's hand, newest card first. */
  readonly hands: readonly (readonly CardId[])[];
  readonly stacks: Readonly<Record<Suit, number>>;
  readonly discardPile: readonly CardId[];
  /** Every card's clue knowledge, indexed by `CardId`. */
  readonly clues: readonly ClueKnowledge[];
}

/**
 * The table before each event in `view.log`, then as it is now: `log.length + 1` moments, so
 * `moments[t]` is the table that `log[t]` happened on.
 *
 * Works backwards from the view. Hands always list their cards newest first, and cards are drawn
 * in id order, so a hand is its card ids in descending order and a played card's slot can be
 * recovered.
 */
export function history(view: PlayerView): Moment[] {
  const hands = view.hands.map((hand) => [...hand]);
  const stacks = { ...view.stacks };
  const discardPile = [...view.discardPile];
  const clues = view.cards.map((card) => ({
    touchedBy: [...card.clues.touchedBy],
    notTouchedBy: [...card.clues.notTouchedBy],
  }));
  const snapshot = (): Moment => ({
    hands: hands.map((hand) => [...hand]),
    stacks: { ...stacks },
    discardPile: [...discardPile],
    clues: clues.map(({ touchedBy, notTouchedBy }) => ({
      touchedBy: [...touchedBy],
      notTouchedBy: [...notTouchedBy],
    })),
  });

  const moments = [snapshot()];
  for (const event of view.log.toReversed()) {
    if (event.type === "clue") {
      for (const id of hands[event.target]!) {
        const knowledge = clues[id]!;
        if (event.touched.includes(id)) knowledge.touchedBy.pop();
        else knowledge.notTouchedBy.pop();
      }
    } else {
      const hand = hands[event.seat]!;
      if (event.drawn !== null) hand.splice(hand.indexOf(event.drawn), 1);
      hand.push(event.cardId);
      hand.sort((a, b) => b - a);
      if (event.type === "play" && event.success) stacks[event.card.suit] = event.card.rank - 1;
      else discardPile.pop();
    }
    moments.push(snapshot());
  }
  return moments.toReversed();
}
