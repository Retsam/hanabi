// Plain-text rendering of games and results for the simulator CLI.
import type { Action, Card, GameEvent, GameState, Seat } from "@hanabi/engine";
import { clueMatches, type RankedMove, type TurnReview } from "@hanabi/hgroup";
import type { PlayerCount, Summary } from "./simulate.ts";

const NAMES = ["Alice", "Bob", "Cathy", "Donald", "Emily"];

export const seatName = (seat: Seat) => NAMES[seat] ?? `Seat ${seat}`;

/** Short card notation, like "r3" for a red 3. */
export const cardName = (card: Card) => `${card.suit[0]}${card.rank}`;

/** One line saying what happened, like "Alice clues Bob red (r3, r1)". */
export function describeEvent(event: GameEvent, state: GameState): string {
  const who = seatName(event.seat);
  if (event.type === "play") {
    return `${who} plays ${cardName(event.card)}${event.success ? "" : " and strikes"}`;
  }
  if (event.type === "discard") return `${who} discards ${cardName(event.card)}`;
  const touched = event.touched.map((id) => cardName(state.cards[id]!.card)).join(", ");
  return `${who} clues ${seatName(event.target)} ${event.clue.value} (${touched})`;
}

/** One line saying what an action would do in `state`, like "Alice clues Bob red (r3, r1)". */
export function describeAction(action: Action, state: GameState): string {
  const who = seatName(state.currentPlayer);
  const card = (id: number) => cardName(state.cards[id]!.card);
  if (action.type === "play") return `${who} plays ${card(action.cardId)}`;
  if (action.type === "discard") return `${who} discards ${card(action.cardId)}`;
  const touched = state.hands[action.target]!.filter((id) =>
    clueMatches(state.cards[id]!.card, action.clue),
  );
  return `${who} clues ${seatName(action.target)} ${action.clue.value} (${touched.map(card).join(", ")})`;
}

/** The category and reasons behind a chosen move, indented to go under its event line. */
export function describeMove(move: RankedMove, indent = "    "): string {
  const reasons = move.reasons.map((reason) => `\n${indent}${reason.text}`).join("");
  return `${indent}[${move.category}, score ${move.score}]${reasons}`;
}

/**
 * A turn of a game review: the move made with where it ranked, then the top alternative. `before` is
 * the state the move was made in and `event` what it did.
 */
export function describeReview(review: TurnReview, before: GameState, event: GameEvent): string {
  const { move, rank, moves, alternative } = review;
  const lines = [
    `${review.turn + 1}. ${describeEvent(event, before)} (rank ${rank} of ${moves})`,
    describeMove(move),
  ];
  if (alternative !== undefined) {
    lines.push(
      `    ${rank === 1 ? "Next best" : "Better"}: ${describeAction(alternative.action, before)}`,
      describeMove(alternative, "        "),
    );
  }
  return lines.join("\n");
}

/** The table's state after a game: stacks, strikes and score. */
export function describeEnd(state: GameState, score: number): string {
  const stacks = state.config.suits.map((suit) => `${suit[0]}${state.stacks[suit]}`).join(" ");
  return `Game over: ${stacks}, ${state.strikes} strikes, score ${score}`;
}

/** One line per player count. */
export function describeSummary(players: PlayerCount, summary: Summary): string {
  const { games, meanScore, perfect, struckOut, meanStrikes, worst } = summary;
  return (
    `${players}p: ${games} games, mean score ${meanScore.toFixed(1)}, ${perfect} perfect, ` +
    `${struckOut} struck out, ${meanStrikes.toFixed(2)} strikes per game, ` +
    `worst seed ${worst.seed} (${worst.score})`
  );
}
