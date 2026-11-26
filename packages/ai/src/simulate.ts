// Self-play for the simulator: deal a seeded game, play it with H-Group seats and summarize the
// results. For exploring how the engine plays; nothing gates on these numbers.
import {
  createGame,
  type GameEvent,
  type GameState,
  maxScore,
  type PlayerView,
  type Replay,
  score,
  shuffledDeck,
  standardConfig,
} from "@hanabi/engine";
import type { Level, RankedMove } from "@hanabi/hgroup";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { runGame } from "./runner.ts";
import { hgroupSeat, type Noise } from "./seat.ts";

export type PlayerCount = 2 | 3 | 4 | 5;

export interface GameResult {
  /** The seed the deck was shuffled from: the same seed and level replay the same game. */
  readonly seed: number;
  readonly score: number;
  readonly strikes: number;
  /** Whether the game ended on its last strike, scoring 0. */
  readonly struckOut: boolean;
  readonly replay: Replay;
  readonly state: GameState;
}

/** Hooks for watching a game as it is played. */
export interface Watcher {
  /** Each move a seat picks, with its category and reasons, before it is applied. */
  readonly onChoose?: (move: RankedMove, view: PlayerView) => void;
  /** Each event, with the full state after it. */
  readonly onEvent?: (event: GameEvent, state: GameState) => void;
}

/**
 * How often seats play a worse move than their best, for games that test how the engine copes with
 * mistakes: on each turn, with probability `rate`, one of the next `among` best moves.
 */
export interface Mistakes {
  readonly rate: number;
  readonly among?: number;
}

/**
 * Deals a game for `numPlayers` from `seed` and plays it to the end with H-Group seats at `level`.
 * With `mistakes`, the seats' slips are drawn from a stream also seeded by `seed`, so a seed still
 * reproduces the game.
 */
export async function selfPlay(
  numPlayers: PlayerCount,
  seed: number,
  level: Level,
  watcher: Watcher = {},
  mistakes?: Mistakes,
): Promise<GameResult> {
  const config = standardConfig(numPlayers);
  const deck = shuffledDeck(config, xoroshiro128plus(seed));
  const noise = mistakes && mistakes.rate > 0 ? mistakeNoise(seed, mistakes) : undefined;
  const seats = Array.from({ length: numPlayers }, () =>
    hgroupSeat(level, watcher.onChoose, noise),
  );
  const { state, actions } = await runGame(createGame(config, deck), seats, watcher.onEvent);
  return {
    seed,
    score: score(state),
    strikes: state.strikes,
    struckOut: state.strikes >= config.maxStrikes,
    replay: { config, deck, actions },
    state,
  };
}

/** The seats' shared slips for a game: a stream jumped well clear of the deck's shuffle. */
function mistakeNoise(seed: number, { rate, among = 3 }: Mistakes): Noise {
  const rng = xoroshiro128plus(seed);
  rng.jump();
  return { rate, among, rng };
}

export interface Summary {
  readonly games: number;
  readonly meanScore: number;
  /** How many games reached the maximum score. */
  readonly perfect: number;
  readonly struckOut: number;
  readonly meanStrikes: number;
  /** The lowest-scoring game, the first one on a tie, to look at more closely. */
  readonly worst: GameResult;
}

/** Totals for a batch of games of one player count. Throws if there are none. */
export function summarize(results: readonly GameResult[]): Summary {
  const [first] = results;
  if (first === undefined) throw new Error("No games to summarize");
  const mean = (value: (result: GameResult) => number) =>
    results.reduce((sum, result) => sum + value(result), 0) / results.length;
  const max = maxScore(first.replay.config);
  return {
    games: results.length,
    meanScore: mean((result) => result.score),
    perfect: results.filter((result) => result.score === max).length,
    struckOut: results.filter((result) => result.struckOut).length,
    meanStrikes: mean((result) => result.strikes),
    worst: results.reduce((worst, result) => (result.score < worst.score ? result : worst)),
  };
}
