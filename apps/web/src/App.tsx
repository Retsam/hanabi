import { maxScore, score } from "@hanabi/engine";
import { useEffect, useRef, useState } from "react";
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

export function App() {
  const [options, setOptions] = useState<SessionOptions | null>(null);
  return options === null ? (
    <Setup onStart={setOptions} />
  ) : (
    <Game key={JSON.stringify(options)} options={options} onLeave={() => setOptions(null)} />
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

function Game({ options, onLeave }: { options: SessionOptions; onLeave: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    const started = startSession(options, setSnapshot);
    session.current = started;
    return () => started.stop();
  }, [options]);

  if (snapshot === null) return null;
  const { view, replay } = snapshot;
  return (
    <div className="game">
      <header>
        <span>
          Seed {options.seed}, {options.numPlayers} players
        </span>
        <button onClick={onLeave}>New game</button>
      </header>
      {error !== null && <p className="error">{error}</p>}
      {replay !== null && (
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
      {replay !== null && reviewing ? (
        <Review replay={replay} level={options.level} you={options.humanSeat} />
      ) : (
        <Table view={view} onAct={(action) => setError(session.current?.submit(action) ?? null)} />
      )}
    </div>
  );
}
