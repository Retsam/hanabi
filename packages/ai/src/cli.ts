// The simulator CLI: runs H-Group self-play games and prints their scores. Run with
// `pnpm simulate --help`.
import { parseArgs } from "node:util";
import type { RankedMove } from "@hanabi/hgroup";
import { describeEnd, describeEvent, describeMove, describeSummary } from "./report.ts";
import { type GameResult, type PlayerCount, selfPlay, summarize } from "./simulate.ts";

const USAGE = `Usage: pnpm simulate [options]

Plays games with every seat taking the H-Group decision engine's top move, and prints a summary
per player count. Game i of a batch is dealt from seed + i, so a seed reproduces a game.

Options:
  --players <list>  Player counts, comma-separated (default 2,3,4,5)
  --games <n>       Games per player count (default 20)
  --seed <n>        Seed of the first game (default 1)
  --level <n>       H-Group level of the table (default 1)
  --verbose         Print every move with its category and reasons
  --help            Show this help`;

const { values } = parseArgs({
  options: {
    players: { type: "string", default: "2,3,4,5" },
    games: { type: "string", default: "20" },
    seed: { type: "string", default: "1" },
    level: { type: "string", default: "1" },
    verbose: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const fail = (message: string): never => {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
};

const integer = (name: string, text: string, min: number): number => {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min) {
    fail(`--${name} must be an integer of at least ${min}, not "${text}"`);
  }
  return value;
};

const isPlayerCount = (value: number): value is PlayerCount => [2, 3, 4, 5].includes(value);
const players = values.players.split(",").map((text) => {
  const value = Number(text);
  return isPlayerCount(value) ? value : fail(`--players takes counts from 2 to 5, not "${text}"`);
});
const games = integer("games", values.games, 1);
const seed = integer("seed", values.seed, 0);
const level = integer("level", values.level, 0);

for (const numPlayers of players) {
  const results: GameResult[] = [];
  for (let i = 0; i < games; i++) {
    if (!values.verbose) {
      results.push(await selfPlay(numPlayers, seed + i, level));
      continue;
    }
    console.log(`\n${numPlayers}p game, seed ${seed + i}`);
    let chosen: RankedMove | undefined;
    const result = await selfPlay(numPlayers, seed + i, level, {
      onChoose: (move) => (chosen = move),
      onEvent: (event, state) => {
        console.log(`${state.turn}. ${describeEvent(event, state)}`);
        if (chosen !== undefined) console.log(describeMove(chosen));
      },
    });
    console.log(describeEnd(result.state, result.score));
    results.push(result);
  }
  console.log(describeSummary(numPlayers, summarize(results)));
}
