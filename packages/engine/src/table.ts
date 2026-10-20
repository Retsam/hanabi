// The public table and how each event changes it, so a game's past can be rebuilt from its log. See
// docs/ARCHITECTURE.md ("Events").
import { castDraft, produce } from "immer";
import type { GameEvent } from "./actions.ts";
import type { CardId, Suit } from "./card.ts";
import type { ClueKnowledge, GameState } from "./state.ts";

/** The public parts of the table at one moment: what every player could see of it. */
export interface Moment {
  /** Each seat's hand, newest card first. */
  readonly hands: readonly (readonly CardId[])[];
  readonly stacks: Readonly<Record<Suit, number>>;
  readonly discardPile: readonly CardId[];
  /** Every card's clue knowledge, indexed by `CardId`. */
  readonly clues: readonly ClueKnowledge[];
}

/** The public parts of `state`'s table. */
export function publicTable(state: Omit<GameState, "opening">): Moment {
  const { hands, stacks, discardPile, cards } = state;
  return { hands, stacks, discardPile, clues: cards.map((card) => card.clues) };
}

/** The table after `event`, applied to the table it happened on. Matches what `apply` does. */
export function applyEvent(moment: Moment, event: GameEvent): Moment {
  return produce(moment, (draft) => {
    if (event.type === "clue") {
      for (const id of draft.hands[event.target]!) {
        const clues = draft.clues[id]!;
        const list = event.touched.includes(id) ? clues.touchedBy : clues.notTouchedBy;
        list.push(castDraft(event.clue));
      }
      return;
    }
    const hand = draft.hands[event.seat]!;
    hand.splice(hand.indexOf(event.cardId), 1);
    if (event.drawn !== null) hand.unshift(event.drawn);
    if (event.type === "play" && event.success) draft.stacks[event.card.suit] = event.card.rank;
    else draft.discardPile.push(event.cardId);
  });
}

/**
 * The table before each event in `game.log`, then as it is now: `log.length + 1` moments, so
 * `moments[t]` is the table that `log[t]` happened on. Works on a `GameState` or a `PlayerView`.
 */
export function history(game: Pick<GameState, "opening" | "log">): Moment[] {
  const moments = [game.opening];
  for (const event of game.log) moments.push(applyEvent(moments.at(-1)!, event));
  return moments;
}
