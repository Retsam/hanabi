// Random-game property checks for hgroup's tests, seeded and sized like the engine's.
import type { Seat } from "@hanabi/engine";
import { type RandomGame, randomGame } from "@hanabi/engine/testing";
import { assert, constantFrom, integer, property } from "fast-check";

// A fresh seed each run, so runs cover different games. fast-check reports it with any failure.
const FC_SEED = Date.now();
// CI sets PROPERTY_GAMES to run more games, as for the engine's property tests.
const PROPERTY_GAMES = Number(process.env.PROPERTY_GAMES ?? 200);

/**
 * Runs `check` (which throws on failure, as `expect` does) on random games, each with a random
 * seat. `share` divides PROPERTY_GAMES, so slower checks can run on fewer games.
 */
export function forRandomGames(share: number, check: (game: RandomGame, seat: Seat) => void) {
  const players = constantFrom(2 as const, 3 as const, 4 as const, 5 as const);
  assert(
    property(players, integer(), integer({ min: 0, max: 4 }), (numPlayers, seed, seat) => {
      check(randomGame(numPlayers, seed), seat % numPlayers);
    }),
    { numRuns: Math.ceil(PROPERTY_GAMES / share), seed: FC_SEED },
  );
}
