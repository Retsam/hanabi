// Invariants that must hold over random legal games. See docs/ARCHITECTURE.md ("Testing").
import { assert, constantFrom, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { type Action, allClues, legalActions, validate } from "./actions";
import { type CardId, RANKS } from "./card";
import { playerView } from "./playerView";
import { type GameState, maxScore, score } from "./state";
import { type RandomGame, randomGame } from "./testing/randomGame";

// Every property runs over the same games (a prefix of them for the slower properties), so each
// game is only generated once. fast-check reports this seed with any failure.
const FC_SEED = Date.now();
// 200 games keep local runs around a second and still catch every reducer bug we have injected. CI
// sets PROPERTY_GAMES to run thousands.
const GAMES = Number(process.env.PROPERTY_GAMES ?? 200);

const cache = new Map<string, RandomGame>();
const gameFor = (numPlayers: 2 | 3 | 4 | 5, seed: number) => {
  const key = `${numPlayers} ${seed}`;
  let game = cache.get(key);
  if (game === undefined) {
    game = randomGame(numPlayers, seed);
    cache.set(key, game);
  }
  return game;
};

/**
 * Checks a property over random games. `check` yields a description of each violation, so a
 * failure says what went wrong on which turn, and the inner loops avoid the cost of `expect`.
 */
function expectForAllGames(check: (game: RandomGame) => Iterable<string>, numRuns = GAMES) {
  const players = constantFrom(2 as const, 3 as const, 4 as const, 5 as const);
  assert(
    property(players, integer(), (numPlayers, seed) => {
      expect([...check(gameFor(numPlayers, seed))]).toEqual([]);
    }),
    { numRuns, seed: FC_SEED },
  );
}

/** Each step of a game: the state before an action, the action, its event and the state after. */
const steps = (game: RandomGame) =>
  game.actions.map((action, i) => ({
    before: game.states[i]!,
    action,
    event: game.events[i]!,
    after: game.states[i + 1]!,
  }));

const stackTotal = (state: GameState) =>
  state.config.suits.reduce((total, suit) => total + (state.stacks[suit] ?? 0), 0);

/** Every action that could be named in `state`, legal or not, including one seat too many. */
function actionSpace(state: GameState): Action[] {
  const { config } = state;
  const ids = state.cards.map(({ id }) => id);
  const clues = allClues(config);
  return [
    ...ids.map((cardId): Action => ({ type: "play", cardId })),
    ...ids.map((cardId): Action => ({ type: "discard", cardId })),
    ...Array.from({ length: config.numPlayers + 1 }, (_, target) =>
      clues.map((clue): Action => ({ type: "clue", target, clue })),
    ).flat(),
  ];
}

// The first property to run generates every game, which takes several seconds at CI's game count.
describe("random games", { timeout: 60_000 }, () => {
  it("end in every way a game can end", () => {
    // Guards the generator: if it stopped reaching an ending, the properties would stop covering it.
    const finals = Array.from({ length: 200 }, (_, seed) => randomGame(2, seed).states.at(-1)!);
    expect(finals.some((state) => state.strikes === state.config.maxStrikes)).toBe(true);
    expect(finals.some((state) => score(state) === maxScore(state.config))).toBe(true);
    expect(finals.some((state) => state.turnsRemaining === 0 && score(state) > 0)).toBe(true);
  });

  it("conserve every card across hands, draw pile, discard pile and stacks", () => {
    expectForAllGames(function* ({ deck, states }) {
      for (const state of states) {
        const zones: CardId[] = [...state.hands.flat(), ...state.drawPile, ...state.discardPile];
        if (new Set(zones).size !== zones.length)
          yield `turn ${state.turn}: a card is in two places`;
        if (zones.length + stackTotal(state) !== deck.length) {
          yield `turn ${state.turn}: ${zones.length} cards in zones and ${stackTotal(state)} played`;
        }
      }
      // Card ids are deck indices, and a card's identity never changes.
      for (const [id, { id: cardId, card }] of states.at(-1)!.cards.entries()) {
        const dealt = deck[id]!;
        if (cardId !== id || card.suit !== dealt.suit || card.rank !== dealt.rank) {
          yield `card ${id} is not the card dealt at that index`;
        }
      }
    });
  });

  it("keep clue tokens, strikes and hand sizes within bounds", () => {
    expectForAllGames(function* ({ config, states }) {
      for (const state of states) {
        const { clueTokens, strikes, turn } = state;
        if (clueTokens < 0 || clueTokens > config.maxClueTokens) {
          yield `turn ${turn}: ${clueTokens} clue tokens`;
        }
        if (strikes < 0 || strikes > config.maxStrikes) yield `turn ${turn}: ${strikes} strikes`;
        for (const [seat, hand] of state.hands.entries()) {
          // Hands only shrink once the draw pile has run out.
          const full = hand.length === config.handSize;
          if (state.drawPile.length > 0 ? !full : hand.length > config.handSize) {
            yield `turn ${turn}: seat ${seat} holds ${hand.length} cards`;
          }
        }
      }
    });
  });

  it("never lower a stack, the score or the strike count", () => {
    expectForAllGames(function* (game) {
      const { config } = game;
      for (const { before, after } of steps(game)) {
        for (const suit of config.suits) {
          const [from, to] = [before.stacks[suit]!, after.stacks[suit]!];
          if (to < from || to > RANKS.length)
            yield `turn ${before.turn}: ${suit} went ${from}->${to}`;
        }
        if (after.strikes < before.strikes) yield `turn ${before.turn}: strikes went down`;
        // Striking out is the only way to lose points, and it loses all of them.
        const struckOut = after.strikes >= config.maxStrikes;
        if (struckOut ? score(after) !== 0 : score(after) < score(before)) {
          yield `turn ${before.turn}: score went ${score(before)}->${score(after)}`;
        }
      }
    });
  });

  it("advance the turn and the current player by one each action, as its event says", () => {
    expectForAllGames(function* (game) {
      for (const { before, action, event, after } of steps(game)) {
        const next = (before.currentPlayer + 1) % game.config.numPlayers;
        if (after.turn !== before.turn + 1) yield `turn ${before.turn}: next turn is ${after.turn}`;
        if (after.currentPlayer !== next)
          yield `turn ${before.turn}: seat ${after.currentPlayer} is next`;
        if (event.seat !== before.currentPlayer || event.type !== action.type) {
          yield `turn ${before.turn}: event does not match the action`;
        }
      }
    });
  });

  it("always end, within the number of turns the deck and clue tokens allow", () => {
    expectForAllGames(function* ({ config, deck, actions, states }) {
      if (states.at(-1)!.status !== "over") yield `not over after ${actions.length} turns`;
      // Every turn draws a card, spends a clue token or is in the final round. Clue tokens only
      // come back from discards and plays, which draw a card unless in the final round.
      const drawPile = deck.length - config.numPlayers * config.handSize;
      const maxTurns = drawPile + (config.maxClueTokens + drawPile) + config.numPlayers;
      if (actions.length > maxTurns) yield `took ${actions.length} turns`;
    });
  });

  it("only end by striking out, completing every stack or finishing the final round", () => {
    expectForAllGames(function* ({ config, states }) {
      for (const [i, state] of states.entries()) {
        const previous = states[i - 1]?.status ?? "playing";
        const { status, turn, drawPile, turnsRemaining } = state;
        if (status === "playing" && (drawPile.length === 0 || previous !== "playing")) {
          yield `turn ${turn}: still playing after ${previous} with ${drawPile.length} cards left`;
        }
        if (
          status === "finalRound" &&
          (drawPile.length > 0 ||
            turnsRemaining === null ||
            turnsRemaining <= 0 ||
            previous === "over")
        ) {
          yield `turn ${turn}: in the final round after ${previous}`;
        }
        const ended =
          state.strikes === config.maxStrikes ||
          stackTotal(state) === maxScore(state.config) ||
          turnsRemaining === 0;
        if ((status === "over") !== ended) yield `turn ${turn}: ${status} but ended is ${ended}`;
      }
    });
  });

  it("give everyone exactly one more turn after the last card is drawn", () => {
    expectForAllGames(function* ({ config, states }) {
      const lastDraw = states.findIndex((state) => state.drawPile.length === 0);
      const final = states.at(-1)!;
      const cutShort =
        final.strikes === config.maxStrikes || stackTotal(final) === maxScore(final.config);
      if (lastDraw === -1 || cutShort) return;
      const finalTurns = states.length - 1 - lastDraw;
      if (finalTurns !== config.numPlayers) yield `the final round lasted ${finalTurns} turns`;
    });
  });

  it("offer exactly the actions validate accepts", () => {
    expectForAllGames(function* ({ states }) {
      for (const state of states) {
        const legal = new Set(legalActions(state).map((action) => JSON.stringify(action)));
        for (const action of actionSpace(state)) {
          const key = JSON.stringify(action);
          if ((validate(state, action) === null) !== legal.has(key)) {
            yield `turn ${state.turn}: validate and legalActions disagree on ${key}`;
          }
        }
        if ((legal.size === 0) !== (state.status === "over")) {
          yield `turn ${state.turn}: ${legal.size} legal actions while ${state.status}`;
        }
      }
    }, GAMES / 4);
  });

  it("never show a seat its own cards or the draw pile", () => {
    expectForAllGames(function* ({ states }) {
      for (const state of states) {
        for (const [seat, hand] of state.hands.entries()) {
          const view = playerView(state, seat);
          const hidden = new Set([...hand, ...state.drawPile]);
          for (const { id, card, clues } of view.cards) {
            const actual = state.cards[id]!;
            if ((card === null) !== hidden.has(id) || (card !== null && card !== actual.card)) {
              yield `turn ${state.turn}: seat ${seat} sees card ${id} wrongly`;
            }
            if (clues !== actual.clues) yield `turn ${state.turn}: seat ${seat} sees wrong clues`;
          }
          if (view.drawPileSize !== state.drawPile.length) {
            yield `turn ${state.turn}: seat ${seat} sees the wrong draw pile size`;
          }
        }
      }
    }, GAMES / 4);
  });
});
