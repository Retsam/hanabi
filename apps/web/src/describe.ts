// Plain-English text for the table, from one seat's view.
import type { Card, Clue, GameEvent, Moment, PlayerView, Seat } from "@hanabi/engine";

const NAMES = ["Alice", "Bob", "Cathy", "Donald", "Emily"];

/** The seat's name, or "You" for the viewer. */
export const seatName = (view: Pick<PlayerView, "seat">, seat: Seat) =>
  seat === view.seat ? "You" : (NAMES[seat] ?? `Seat ${seat}`);

/** Short card notation, like "r3" for a red 3. */
export const cardName = (card: Card) => `${card.suit[0]}${card.rank}`;

export const clueName = (clue: Clue) => String(clue.value);

/**
 * One line saying what happened, like "Alice clues Bob red on slots 1, 3". `moment` is the table the
 * event happened on, for the slots a clue touched.
 */
export function describeEvent(view: PlayerView, event: GameEvent, moment: Moment): string {
  const who = seatName(view, event.seat);
  if (event.type === "play") {
    return event.success
      ? `${who} played ${cardName(event.card)}`
      : `${who} misplayed ${cardName(event.card)} (strike)`;
  }
  if (event.type === "discard") return `${who} discarded ${cardName(event.card)}`;
  const hand = moment.hands[event.target]!;
  const slots = event.touched.map((id) => hand.indexOf(id) + 1).toSorted((a, b) => a - b);
  const s = slots.length === 1 ? "" : "s";
  return `${who} clued ${seatName(view, event.target)} ${clueName(event.clue)} on slot${s} ${slots.join(", ")}`;
}
