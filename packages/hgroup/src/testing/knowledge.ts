// Shorthands for reading scenario games in hgroup's tests.
import { type Card, type CardId, playerView, type Seat } from "@hanabi/engine";
import type { Scenario } from "@hanabi/engine/testing";
import { focusCards, privateKnowledge, readGame } from "../knowledge";

/** Card names ("r4") for a list of identities, to keep expectations short. */
export const names = (cards: readonly Card[]) => cards.map((card) => `${card.suit[0]}${card.rank}`);

/** The game read from `seat`'s view at a particular level (1 by default). */
export const read = (game: Scenario, seat: Seat, level = 1) =>
  readGame(playerView(game.state, seat), level);

/** What the table agrees a card could be, as card names. */
export const common = (game: Scenario, seat: Seat, id: CardId) =>
  names(read(game, seat).common[id]!);

/** What `seat` knows a card could be, as card names. */
export const own = (game: Scenario, seat: Seat, id: CardId) =>
  names(privateKnowledge(playerView(game.state, seat), read(game, seat))[id]!);

/**
 * The latest clue's reading, with what its focus could still be as a play or save clue as card
 * names.
 */
export const lastReading = (game: Scenario, seat: Seat) => {
  const reading = read(game, seat).readings.at(-1)!;
  return {
    ...reading,
    play: names(focusCards(reading, "play")),
    save: names(focusCards(reading, "save")),
  };
};
