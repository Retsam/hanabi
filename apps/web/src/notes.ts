// The human's own notes on cards: identities they've crossed off and free text. These are the
// player's annotations, like hanab.live's notes, not engine knowledge; the AI seats never see them.
import type { Card, CardId } from "@hanabi/engine";

export interface CardNote {
  /** Identities the player has ruled out, as `identityKey`s. */
  readonly crossedOff: readonly string[];
  readonly text: string;
}

/** Notes by card. A card with no marks and no text has no entry. */
export type Notes = Readonly<Record<CardId, CardNote>>;

export const EMPTY_NOTE: CardNote = { crossedOff: [], text: "" };

export const identityKey = (card: Card): string => `${card.suit} ${card.rank}`;

/** `possible` without the identities the note crosses off. */
export function markedPossibilities(possible: readonly Card[], note: CardNote | undefined): Card[] {
  if (note === undefined) return [...possible];
  return possible.filter((card) => !note.crossedOff.includes(identityKey(card)));
}

/** Crosses `card` off, or back on if it already was. */
export function toggleIdentity(note: CardNote, card: Card): CardNote {
  const key = identityKey(card);
  return {
    ...note,
    crossedOff: note.crossedOff.includes(key)
      ? note.crossedOff.filter((each) => each !== key)
      : [...note.crossedOff, key],
  };
}

/** `notes` with `id`'s note replaced, dropping it once it is empty. */
export function setNote(notes: Notes, id: CardId, note: CardNote): Notes {
  const { [id]: _, ...rest } = notes;
  return note.crossedOff.length === 0 && note.text.trim() === "" ? rest : { ...rest, [id]: note };
}
