import {
  type Action,
  type CardId,
  maxScore,
  playerView,
  replay as replayGame,
  score,
} from "@hanabi/engine";
import { type Level, MAX_LEVEL } from "@hanabi/hgroup";
import { useEffect, useRef, useState } from "react";
import { clearGame, loadGame, loadLevel, type SavedGame, saveGame, saveLevel } from "./saved.ts";
import {
  type PlayerCount,
  type Session,
  type SessionOptions,
  type Snapshot,
  startSession,
} from "./session.ts";
import { type CardNote, type Notes, setNote } from "./notes.ts";
import { Review } from "./Review.tsx";
import { Table } from "./Table.tsx";

const PLAYER_COUNTS: readonly PlayerCount[] = [2, 3, 4, 5];
/** Every level up to the highest one the H-Group engine has a convention for. */
const LEVELS: readonly Level[] = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
const randomSeed = () => Math.floor(Math.random() * 1_000_000);

/** A game to play: new from its options, or resumed from a saved record. */
type GameStart = Pick<SavedGame, "options"> &
  Partial<Pick<SavedGame, "record" | "abandoned" | "notes">>;

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
  const [level, setLevel] = useState<Level>(() => loadLevel(LEVELS) ?? 1);
  return (
    <form
      className="setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart({ numPlayers, seed, level, humanSeat: 0, aiDelayMs: 600 });
      }}
    >
      <h1>Hanabi</h1>
      <p>You play with H-Group AI teammates, all playing at the level you pick.</p>
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
        Level{" "}
        <select
          value={level}
          onChange={(event) => {
            const picked = LEVELS[event.target.selectedIndex]!;
            setLevel(picked);
            saveLevel(picked);
          }}
        >
          {LEVELS.map((n) => (
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

function Game({ options, record, onLeave, ...start }: GameStart & { onLeave: () => void }) {
  // An abandoned game is never played on, so its table comes straight from its record.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() =>
    start.abandoned === true && record !== undefined
      ? { view: playerView(replayGame(record).state, options.humanSeat), record }
      : null,
  );
  const [abandoned, setAbandoned] = useState(start.abandoned === true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [notes, setNotes] = useState<Notes>(start.notes ?? {});
  // The session saves after each move from its own callback, which needs the latest notes.
  const notesRef = useRef(notes);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    if (abandoned) return undefined;
    const started = startSession(
      options,
      (next) => {
        setSnapshot(next);
        saveGame({ options, record: next.record, notes: notesRef.current });
      },
      record,
    );
    session.current = started;
    return () => started.stop();
  }, [options, record, abandoned]);

  /** Stops the game where it stands and shows it as over, saved as abandoned so it can be reviewed. */
  const abandon = () => {
    session.current?.stop();
    if (snapshot !== null) saveGame({ options, record: snapshot.record, abandoned: true, notes });
    setAbandoned(true);
    setAbandoning(false);
  };

  /** Ends this game for good: it is no longer saved, so a reload starts at the setup screen. */
  const leave = () => {
    session.current?.stop();
    clearGame();
    onLeave();
  };

  if (snapshot === null) return null;
  const { view, record: replay } = snapshot;
  const over = abandoned || view.status === "over";

  const changeNote = (id: CardId, note: CardNote) => {
    const next = setNote(notes, id, note);
    setNotes(next);
    notesRef.current = next;
    saveGame({ options, record: replay, notes: next, ...(abandoned && { abandoned }) });
  };
  return (
    <div className="game">
      <header>
        <span>
          Seed {options.seed}, {options.numPlayers} players, level {options.level}
        </span>
        {over ? (
          <button onClick={leave}>New game</button>
        ) : abandoning ? (
          <span className="buttons">
            Abandon this game?
            <button onClick={abandon}>Abandon</button>
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
            {abandoned ? "Game abandoned" : "Game over"}: {score(view)}/{maxScore(view.config)}
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
        <Table
          view={view}
          level={options.level}
          notes={notes}
          onNote={changeNote}
          {...(!over && {
            onAct: (action: Action) => setError(session.current?.submit(action) ?? null),
          })}
        />
      )}
    </div>
  );
}
