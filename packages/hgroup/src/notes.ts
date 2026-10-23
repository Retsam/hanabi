// Notes: the identities a card could be, in suit then rank order, and the few operations the
// conventions use on them.
import type { Card } from "@hanabi/engine";
import { sameCard } from "./possibilities.ts";

export type Note = readonly Card[];

/** Whether the card could be `card`. */
export const couldBe = (note: Note, card: Card): boolean =>
  note.some((other) => sameCard(other, card));

/** The card's identity, if the note pins it down to one. */
export const identity = (note: Note): Card | undefined => (note.length === 1 ? note[0] : undefined);

/**
 * `note` narrowed to the cards `keep` allows, or `note` itself if that would leave nothing: a
 * deduction that contradicts what is known (after a misread clue, say) is ignored.
 */
export function narrowed(note: Note, keep: (card: Card) => boolean): Note {
  const result = note.filter(keep);
  return result.length > 0 ? result : note;
}

/** Whether two lists of notes are the same size card for card. Narrowing only removes cards. */
export const sameSizes = (a: readonly Note[], b: readonly Note[]): boolean =>
  a.every((note, i) => note.length === b[i]!.length);
