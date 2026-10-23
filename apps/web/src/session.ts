// One game in the browser: a human seat plus H-Group AI seats, played with `runGame`. The UI only
// ever sees the human's view; the full state stays in here.
import { hgroupSeat, runGame, type SeatController } from "@hanabi/ai";
import {
  type Action,
  createGame,
  type GameState,
  type PlayerView,
  playerView,
  type Replay,
  type Seat,
  shuffledDeck,
  standardConfig,
  validate,
} from "@hanabi/engine";
import type { Level } from "@hanabi/hgroup";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";

export type PlayerCount = 2 | 3 | 4 | 5;

export interface SessionOptions {
  readonly numPlayers: PlayerCount;
  /** The deck is shuffled from this seed, as in `pnpm simulate`, so a seed deals the same game. */
  readonly seed: number;
  readonly level: Level;
  readonly humanSeat: Seat;
  /** How long each AI seat waits before moving, so the human can follow along. */
  readonly aiDelayMs: number;
}

/** What the UI renders after each change. */
export interface Snapshot {
  readonly view: PlayerView;
  /** The game's record, once it is over. */
  readonly replay: Replay | null;
}

export interface Session {
  /** Makes the human's move. Returns why it is illegal, or null once it is taken. */
  submit(action: Action): string | null;
  /** Abandons the game: no more AI moves or updates. */
  stop(): void;
}

/** Deals a game and plays it, calling `onUpdate` with the human's view at the start and after every move. */
export function startSession(
  options: SessionOptions,
  onUpdate: (snapshot: Snapshot) => void,
): Session {
  const config = standardConfig(options.numPlayers);
  const deck = shuffledDeck(config, xoroshiro128plus(options.seed));
  let state: GameState = createGame(config, deck);
  const abort = new AbortController();
  const human = humanSeat();

  const update = (replay: Replay | null) => {
    if (!abort.signal.aborted) onUpdate({ view: playerView(state, options.humanSeat), replay });
  };

  const seats = Array.from({ length: options.numPlayers }, (_, seat) =>
    seat === options.humanSeat
      ? human.controller
      : paced(hgroupSeat(options.level), options.aiDelayMs, abort.signal),
  );
  update(null);
  void runGame(state, seats, (_, next) => {
    state = next;
    update(null);
  }).then(
    ({ actions }) => update({ config, deck, actions }),
    (error: unknown) => {
      if (!abort.signal.aborted) reportError(error);
    },
  );

  return {
    submit(action) {
      if (state.currentPlayer !== options.humanSeat) return "It is not your turn";
      const illegal = validate(state, action);
      if (illegal === null) human.submit(action);
      return illegal;
    },
    stop: () => abort.abort(),
  };
}

/** A seat whose moves come from the UI: `chooseAction` waits for `submit`. */
export function humanSeat(): { controller: SeatController; submit(action: Action): void } {
  let resolve: ((action: Action) => void) | null = null;
  return {
    controller: {
      chooseAction: () => new Promise((done) => (resolve = done)),
    },
    submit(action) {
      if (resolve === null) throw new Error("The human seat is not being asked for a move");
      const done = resolve;
      resolve = null;
      done(action);
    },
  };
}

/** Delays a seat's moves by `delayMs`. Rejects once `signal` aborts. */
function paced(seat: SeatController, delayMs: number, signal: AbortSignal): SeatController {
  return {
    ...seat,
    chooseAction: async (view) => {
      await wait(delayMs, signal);
      return seat.chooseAction(view);
    },
  };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}
