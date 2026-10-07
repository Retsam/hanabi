// Rules-level card deduction: what each card could be from clues and visible cards, with no
// conventions applied. See docs/ARCHITECTURE.md ("Knowledge model").
import {
  type Card,
  type CardId,
  type Clue,
  type ClueKnowledge,
  type GameConfig,
  type PlayerView,
  RANKS,
} from "@hanabi/engine";

/** Every distinct card identity in the config, in suit then rank order. */
export function identities(config: GameConfig): Card[] {
  return config.suits.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

/** How many copies of `card` the deck holds. */
export const copies = (config: GameConfig, card: Card): number => config.rankCounts[card.rank];

const matches = (card: Card, clue: Clue) =>
  clue.kind === "color" ? card.suit === clue.value : card.rank === clue.value;

/**
 * The identities consistent with a card's clue knowledge alone: it matches every clue that touched
 * it and none of the clues it was present for but not touched by. Every player knows this much
 * about every card. In suit then rank order.
 */
export function cluePossibilities(config: GameConfig, clues: ClueKnowledge): Card[] {
  return identities(config).filter(
    (card) =>
      clues.touchedBy.every((clue) => matches(card, clue)) &&
      !clues.notTouchedBy.some((clue) => matches(card, clue)),
  );
}

/**
 * What the viewer can deduce each card to be, indexed by `CardId`. A visible card is exactly
 * itself. A hidden card (in the viewer's hand or the draw pile) is whatever its clues allow, minus
 * any identity whose every copy is already accounted for: visible somewhere, or deduced for
 * another of the viewer's cards. Deductions repeat until nothing changes, since pinning down one
 * card can pin down another. In suit then rank order.
 */
export function possibilities(view: PlayerView): (readonly Card[])[] {
  const { config } = view;
  // Identities are handled by their index in `all`, which is also their sort order.
  const all = identities(config);
  const indexOf = (card: Card) =>
    config.suits.indexOf(card.suit) * RANKS.length + RANKS.indexOf(card.rank);
  const limit = all.map((card) => copies(config, card));
  const accounted = all.map(() => 0);
  for (const { card } of view.cards) if (card !== null) accounted[indexOf(card)]!++;

  const result: (readonly Card[])[] = view.cards.map(({ card }) => (card === null ? [] : [card]));
  // Clue-only candidates are shared between cards with the same clues, such as the whole draw pile.
  const candidatesByClues = new Map<string, number[]>();
  const hidden = view.cards
    .filter(({ card }) => card === null)
    .map(({ id, clues }) => {
      const key = JSON.stringify(clues);
      let candidates = candidatesByClues.get(key);
      if (candidates === undefined) {
        candidates = cluePossibilities(config, clues).map(indexOf);
        candidatesByClues.set(key, candidates);
      }
      return { id, candidates };
    });
  // The identity each hidden card is currently deduced to be, if just one; it counts as accounted.
  const deduced = new Map<CardId, number>();
  const remaining = new Map<CardId, number[]>();

  let changed = true;
  while (changed) {
    changed = false;
    for (const { id, candidates } of hidden) {
      const own = deduced.get(id);
      const possible = candidates.filter((i) => accounted[i]! - (own === i ? 1 : 0) < limit[i]!);
      remaining.set(id, possible);

      const single = possible.length === 1 ? possible[0] : undefined;
      if (single !== own) {
        if (own !== undefined) accounted[own]!--;
        if (single === undefined) deduced.delete(id);
        else {
          accounted[single]!++;
          deduced.set(id, single);
        }
        changed = true;
      }
    }
  }
  for (const [id, possible] of remaining) result[id] = possible.map((i) => all[i]!);
  return result;
}
