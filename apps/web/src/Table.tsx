// The play screen: everything the viewer's seat can see, and the moves it can make on its turn.
import {
  type Action,
  type Clue,
  type GameEvent,
  history,
  maxScore,
  score,
  type PlayerView,
  RANKS,
  type Seat,
} from "@hanabi/engine";
import { clueMatches } from "@hanabi/hgroup";
import { useState } from "react";
import { HandCard } from "./Card.tsx";
import { clueName, describeEvent, seatName } from "./describe.ts";

export function Table(props: { view: PlayerView; onAct: (action: Action) => void }) {
  const { view, onAct } = props;
  const [considering, setConsidering] = useState<{ target: Seat; clue: Clue } | null>(null);
  const myTurn = view.currentPlayer === view.seat && view.status !== "over";
  const others = Array.from(
    { length: view.config.numPlayers - 1 },
    (_, i) => (view.seat + 1 + i) % view.config.numPlayers,
  );

  return (
    <div className="table">
      <Status view={view} />
      <Stacks view={view} />
      {others.map((seat) => (
        <section
          key={seat}
          className={
            seat === view.currentPlayer && view.status !== "over" ? "seat current" : "seat"
          }
        >
          <h2>{seatName(view, seat)}</h2>
          <div className="hand">
            {view.hands[seat]!.map((id) => (
              <HandCard
                key={id}
                view={view}
                id={id}
                highlight={
                  considering?.target === seat &&
                  clueMatches(view.cards[id]!.card!, considering.clue)
                }
              />
            ))}
          </div>
          {myTurn && (
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
      <section className={myTurn ? "seat current" : "seat"}>
        <h2>Your hand{myTurn && ": your turn"}</h2>
        <div className="hand">
          {view.hands[view.seat]!.map((id) => (
            <HandCard key={id} view={view} id={id}>
              {myTurn && (
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
      </section>
      <Discards view={view} />
      <Log view={view} />
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

function Log({ view }: { view: PlayerView }) {
  const moments = history(view);
  const lines = view.log.map((event: GameEvent, i) => describeEvent(view, event, moments[i]!));
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
