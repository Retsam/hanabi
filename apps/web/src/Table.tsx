// The table as one seat sees it, with the human's moves on their turn. The review reuses it read-only.
import {
  type Action,
  type CardId,
  type Clue,
  type GameEvent,
  history,
  maxScore,
  score,
  type PlayerView,
  RANKS,
  type Seat,
} from "@hanabi/engine";
import { clueMatches, type Level } from "@hanabi/hgroup";
import { useMemo, useState } from "react";
import { HandCard, NoteEditor } from "./Card.tsx";
import { chops, clueName, describeEvent, seatName } from "./describe.ts";
import type { CardNote, Notes } from "./notes.ts";

export function Table(props: {
  view: PlayerView;
  /** The table's H-Group level, for reading chops in the log. */
  level: Level;
  /** The human's seat, shown at the bottom as "You". Defaults to the view's seat. */
  you?: Seat;
  /** Makes the human's moves. Without it the table is read-only. */
  onAct?: (action: Action) => void;
  /** Cards to mark, such as the ones a reviewed move used. */
  highlight?: ReadonlySet<CardId>;
  /** The player's notes on cards, shown under each card. */
  notes?: Notes;
  /** Changes a card's note. With it, clicking a card in a hand opens its notes. */
  onNote?: (id: CardId, note: CardNote) => void;
}) {
  const { view, level, you = view.seat, onAct, highlight, notes, onNote } = props;
  const [considering, setConsidering] = useState<{ target: Seat; clue: Clue } | null>(null);
  const [editing, setEditing] = useState<CardId | null>(null);
  const live = view.status !== "over";
  const myTurn = onAct !== undefined && live && view.currentPlayer === you;
  const seats = Array.from(
    { length: view.config.numPlayers },
    (_, i) => (you + 1 + i) % view.config.numPlayers,
  );
  const marked = (seat: Seat, id: CardId) =>
    highlight?.has(id) === true ||
    (considering?.target === seat && clueMatches(view.cards[id]!.card!, considering.clue));

  return (
    <div className="table">
      <Status view={view} />
      <Stacks view={view} />
      {seats.map((seat) => (
        <section
          key={seat}
          className={seat === view.currentPlayer && live ? "seat current" : "seat"}
        >
          <h2>
            {seat === you ? "Your hand" : seatName(you, seat)}
            {myTurn && seat === you && ": your turn"}
          </h2>
          <div className="hand">
            {view.hands[seat]!.map((id) => (
              <HandCard
                key={id}
                view={view}
                id={id}
                highlight={marked(seat, id)}
                note={notes?.[id]}
                {...(onNote !== undefined && { onOpen: () => setEditing(id) })}
              >
                {myTurn && seat === you && (
                  <div className="card-actions">
                    <button onClick={() => onAct({ type: "play", cardId: id })}>Play</button>
                    <button
                      disabled={view.clueTokens >= view.config.maxClueTokens}
                      onClick={() => onAct({ type: "discard", cardId: id })}
                    >
                      Discard
                    </button>
                  </div>
                )}
              </HandCard>
            ))}
          </div>
          {myTurn && seat !== you && (
            <ClueButtons
              view={view}
              target={seat}
              onConsider={(clue) => setConsidering(clue && { target: seat, clue })}
              onClue={(clue) => {
                setConsidering(null);
                onAct({ type: "clue", target: seat, clue });
              }}
            />
          )}
        </section>
      ))}
      <Discards view={view} />
      <Log view={view} level={level} you={you} />
      {editing !== null && onNote !== undefined && (
        <NoteEditor
          view={view}
          id={editing}
          note={notes?.[editing]}
          onChange={(note) => onNote(editing, note)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Status({ view }: { view: PlayerView }) {
  return (
    <div className="status">
      <span>
        Score {score(view)}/{maxScore(view.config)}
      </span>
      <span>
        Clues {view.clueTokens}/{view.config.maxClueTokens}
      </span>
      <span>
        Strikes {view.strikes}/{view.config.maxStrikes}
      </span>
      <span>Deck {view.drawPileSize}</span>
      {view.turnsRemaining !== null && view.status !== "over" && (
        <span>Final round: {view.turnsRemaining} turns left</span>
      )}
    </div>
  );
}

function Stacks({ view }: { view: PlayerView }) {
  return (
    <div className="stacks">
      {view.config.suits.map((suit) => {
        const height = view.stacks[suit] ?? 0;
        return (
          <div key={suit} className={`card stack suit-${suit}${height === 0 ? " empty" : ""}`}>
            {height || ""}
          </div>
        );
      })}
    </div>
  );
}

function ClueButtons(props: {
  view: PlayerView;
  target: Seat;
  onConsider: (clue: Clue | null) => void;
  onClue: (clue: Clue) => void;
}) {
  const { view, target } = props;
  const clues: Clue[] = [
    ...view.config.suits.map((value) => ({ kind: "color", value }) as const),
    ...RANKS.map((value) => ({ kind: "rank", value }) as const),
  ];
  return (
    <div className="clues">
      {clues.map((clue) => {
        const touches = view.hands[target]!.some((id) => clueMatches(view.cards[id]!.card!, clue));
        return (
          <button
            key={`${clue.kind} ${clue.value}`}
            className={clue.kind === "color" ? `clue suit-${clue.value}` : "clue"}
            disabled={view.clueTokens === 0 || !touches}
            title={`Clue ${clueName(clue)}`}
            onMouseEnter={() => props.onConsider(clue)}
            onMouseLeave={() => props.onConsider(null)}
            onClick={() => props.onClue(clue)}
          >
            {clue.kind === "rank" ? clue.value : ""}
          </button>
        );
      })}
    </div>
  );
}

function Discards({ view }: { view: PlayerView }) {
  return (
    <section className="discards">
      <h2>Discards</h2>
      {view.config.suits.map((suit) => {
        const cards = view.discardPile
          .map((id) => view.cards[id]!.card!)
          .filter((card) => card.suit === suit)
          .toSorted((a, b) => a.rank - b.rank);
        return (
          <div key={suit} className="discard-row">
            {cards.map((card, i) => (
              <span key={i} className={`mini suit-${suit}`}>
                {card.rank}
              </span>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function Log({ view, level, you }: { view: PlayerView; level: Level; you: Seat }) {
  const lines = useMemo(() => {
    const moments = history(view);
    const chopIds = chops(view, level);
    return view.log.map((event: GameEvent, i) =>
      describeEvent(you, event, moments[i]!, chopIds[i]),
    );
  }, [view, level, you]);
  return (
    <section className="log">
      <h2>Log</h2>
      <ol reversed>
        {lines.toReversed().map((line, i) => (
          <li key={lines.length - i}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
