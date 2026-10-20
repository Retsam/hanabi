// Plain-text rendering of games and results for the simulator CLI.
import type { Card, GameEvent, GameState, Seat } from "@hanabi/engine";
import type { RankedMove } from "@hanabi/hgroup";
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

/** The category and reasons behind a chosen move, indented to go under its event line. */
export function describeMove(move: RankedMove): string {
  const reasons = move.reasons.map((reason) => `\n    ${reason.text}`).join("");
  return `    [${move.category}, score ${move.score}]${reasons}`;
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
