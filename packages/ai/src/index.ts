// Seat controllers, the headless game runner and self-play. See docs/ARCHITECTURE.md ("Seats and AIs").
export { type GameRun, runGame } from "./runner.ts";
export { hgroupSeat, type SeatController, syncSeat } from "./seat.ts";
export {
  type GameResult,
  type PlayerCount,
  selfPlay,
  type Summary,
  summarize,
  type Watcher,
} from "./simulate.ts";
