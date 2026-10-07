// Random legal games for property tests.
import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { type Action, apply, legalActions } from "../actions";
import { standardConfig } from "../config";
import { shuffledDeck } from "../deck";
import type { Replay, ReplayResult } from "../replay";
import { createGame } from "../state";

/** A random game's record, plus every state and event it went through. */
export type RandomGame = Replay & ReplayResult;

// Percent chances, picked once per game, of playing a playable card when there is one and of
// playing a card without checking it.
const PLAY_CHANCES = [40, 95];
const MISPLAY_CHANCES = [0, 2, 5, 20];

/**
 * Plays a game to the end with random legal actions, using `seed` for both the deck and the moves.
 * Purely random moves would misplay their way to a strikeout within a dozen turns, so the moves
 * peek at the cards: each game has its own chances of playing a playable card and of a blind play.
 * That way games end in all three ways: strikeouts, final rounds and (rarely) perfect scores.
 * Gives up after `maxTurns`, so a reducer bug that never ends the game fails the caller's checks
 * instead of hanging.
 */
export function randomGame(numPlayers: 2 | 3 | 4 | 5, seed: number, maxTurns = 1000): RandomGame {
  const config = standardConfig(numPlayers);
  const deck = shuffledDeck(config, xoroshiro128plus(seed));
  const rng = xoroshiro128plus(seed ^ 0x5eed);
  const pick = <T>(options: readonly T[]): T => options[uniformInt(rng, 0, options.length - 1)]!;
  const playChance = pick(PLAY_CHANCES);
  const misplayChance = pick(MISPLAY_CHANCES);

  let state = createGame(config, deck);
  const states = [state];
  const actions: Action[] = [];
  while (state.status !== "over" && actions.length < maxTurns) {
    const legal = legalActions(state);
    const plays = legal.filter((action) => action.type === "play");
    const playable = plays.filter((action) => {
      const { suit, rank } = state.cards[action.cardId]!.card;
      return state.stacks[suit] === rank - 1;
    });
    const others = legal.filter((action) => action.type !== "play");
    // Pick discards and clues as often as each other, despite there being many more clues.
    const otherTypes = [...new Set(others.map((action) => action.type))];

    const roll = uniformInt(rng, 0, 99);
    let action: Action;
    if (playable.length > 0 && roll < playChance) action = pick(playable);
    else if (roll >= 100 - misplayChance || others.length === 0) action = pick(plays);
    else {
      const type = pick(otherTypes);
      action = pick(others.filter((other) => other.type === type));
    }

    const result = apply(state, action);
    state = result.state;
    states.push(state);
    actions.push(action);
  }
  return { config, deck, actions, states, events: state.log, state };
}
