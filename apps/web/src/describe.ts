// Plain-English text for the table. `you` is the human's seat, named "You".
import type {
  Action,
  Card,
  CardId,
  Clue,
  GameEvent,
  Moment,
  PlayerView,
  Seat,
} from "@hanabi/engine";
import { clueMatches } from "@hanabi/hgroup";

const NAMES = ["Alice", "Bob", "Cathy", "Donald", "Emily"];

/** The seat's name, or "You" for the human. */
export const seatName = (you: Seat, seat: Seat) =>
  seat === you ? "You" : (NAMES[seat] ?? `Seat ${seat}`);

/** Short card notation, like "r3" for a red 3. */
export const cardName = (card: Card) => `${card.suit[0]}${card.rank}`;

export const clueName = (clue: Clue) => String(clue.value);

/**
 * One line saying what happened, like "Alice clued Bob red on slots 1, 3". `moment` is the table the
 * event happened on, for the slots a clue touched.
 */
export function describeEvent(you: Seat, event: GameEvent, moment: Moment): string {
  const who = seatName(you, event.seat);
  if (event.type === "play") {
    return event.success
      ? `${who} played ${cardName(event.card)}`
      : `${who} misplayed ${cardName(event.card)} (strike)`;
  }
  if (event.type === "discard") return `${who} discarded ${cardName(event.card)}`;
  return `${who} clued ${seatName(you, event.target)} ${clueName(event.clue)} on ${slots(moment.hands[event.target]!, event.touched)}`;
}

/**
 * One line saying what an action would do, from its player's `view`, like "Bob plays slot 2" or
 * "You clue Cathy red on slot 1". The player's own cards are named by slot, since they can't see them.
 */
export function describeAction(you: Seat, view: PlayerView, action: Action): string {
  const who = seatName(you, view.currentPlayer);
  const s = view.currentPlayer === you ? "" : "s";
  if (action.type !== "clue") {
    const slot = view.hands[view.currentPlayer]!.indexOf(action.cardId) + 1;
    return `${who} ${action.type === "play" ? "play" : "discard"}${s} slot ${slot}`;
  }
  const hand = view.hands[action.target]!;
  const touched = hand.filter((id) => clueMatches(view.cards[id]!.card!, action.clue));
  return `${who} clue${s} ${seatName(you, action.target)} ${clueName(action.clue)} on ${slots(hand, touched)}`;
}

function slots(hand: readonly CardId[], touched: readonly CardId[]): string {
  const list = touched.map((id) => hand.indexOf(id) + 1).toSorted((a, b) => a - b);
  return `slot${list.length === 1 ? "" : "s"} ${list.join(", ")}`;
}
