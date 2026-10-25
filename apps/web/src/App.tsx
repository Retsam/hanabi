import { maxScore, score } from "@hanabi/engine";
import { useEffect, useRef, useState } from "react";
import { clearGame, loadGame, type SavedGame, saveGame } from "./saved.ts";
import {
  type PlayerCount,
  type Session,
  type SessionOptions,
  type Snapshot,
  startSession,
} from "./session.ts";
import { Review } from "./Review.tsx";
import { Table } from "./Table.tsx";

const PLAYER_COUNTS: readonly PlayerCount[] = [2, 3, 4, 5];
const randomSeed = () => Math.floor(Math.random() * 1_000_000);

/** A game to play: new from its options, or resumed from a saved record. */
type GameStart = Pick<SavedGame, "options"> & Partial<Pick<SavedGame, "record">>;

export function App() {
  const [start, setStart] = useState<GameStart | null>(loadGame);
  return start === null ? (
    <Setup onStart={(options) => setStart({ options })} />
  ) : (
    <Game key={JSON.stringify(start.options)} {...start} onLeave={() => setStart(null)} />
  );
}

function Setup({ onStart }: { onStart: (options: SessionOptions) => void }) {
  const [numPlayers, setNumPlayers] = useState<PlayerCount>(3);
  const [seed, setSeed] = useState(randomSeed);
  return (
    <form
      className="setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart({ numPlayers, seed, level: 1, humanSeat: 0, aiDelayMs: 600 });
      }}
    >
      <h1>Hanabi</h1>
      <p>You play with H-Group level 1 AI teammates.</p>
      <label>
        Players{" "}
        <select
          value={numPlayers}
          onChange={(event) => setNumPlayers(PLAYER_COUNTS[event.target.selectedIndex]!)}
        >
          {PLAYER_COUNTS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label>
        Seed{" "}
        <input
          type="number"
          value={seed}
          onChange={(event) => setSeed(Number(event.target.value))}
        />
      </label>
      <button type="submit">Start</button>
    </form>
  );
}

function Game({ options, record, onLeave }: GameStart & { onLeave: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    const started = startSession(
      options,
      (next) => {
        setSnapshot(next);
        saveGame({ options, record: next.record });
      },
      record,
    );
    session.current = started;
    return () => started.stop();
  }, [options, record]);

  /** Ends this game for good: it is no longer saved, so a reload starts at the setup screen. */
  const leave = () => {
    session.current?.stop();
    clearGame();
    onLeave();
  };

  if (snapshot === null) return null;
  const { view, record: replay } = snapshot;
  const over = view.status === "over";
  return (
    <div className="game">
      <header>
        <span>
          Seed {options.seed}, {options.numPlayers} players
        </span>
        {over ? (
          <button onClick={leave}>New game</button>
        ) : abandoning ? (
          <span className="buttons">
            Abandon this game?
            <button onClick={leave}>Abandon</button>
            <button onClick={() => setAbandoning(false)}>Keep playing</button>
          </span>
        ) : (
          <button onClick={() => setAbandoning(true)}>Abandon game</button>
        )}
      </header>
      {error !== null && <p className="error">{error}</p>}
      {over && (
        <div className="over">
          <strong>
            Game over: {score(view)}/{maxScore(view.config)}
          </strong>
          <span className="buttons">
            <button onClick={() => setReviewing(!reviewing)}>
              {reviewing ? "Back to the table" : "Review game"}
            </button>
            <button onClick={() => void navigator.clipboard.writeText(JSON.stringify(replay))}>
              Copy replay
            </button>
          </span>
        </div>
      )}
      {over && reviewing ? (
        <Review replay={replay} level={options.level} you={options.humanSeat} />
      ) : (
        <Table view={view} onAct={(action) => setError(session.current?.submit(action) ?? null)} />
      )}
    </div>
  );
}
