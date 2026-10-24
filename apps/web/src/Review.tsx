// The review screen: step through a finished game, seeing each move from its player's view with how
// the decision engine judged it and what it would have done instead.
import { type CardId, playerView, type PlayerView, type Replay, type Seat } from "@hanabi/engine";
import type { Category, Level, RankedMove } from "@hanabi/hgroup";
import { useEffect, useState } from "react";
import { describeAction, describeEvent, seatName } from "./describe.ts";
import { type ReviewedTurn, reviewTurns } from "./review.ts";
import { Table } from "./Table.tsx";

const CATEGORY: Record<Category, string> = {
  mandated: "Mandated",
  permitted: "Permitted",
  violates: "Violates",
};

export function Review(props: { replay: Replay; level: Level; you: Seat }) {
  const { you } = props;
  const [turns, setTurns] = useState<ReviewedTurn[] | null>(null);
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Let "Reviewing…" paint before the engine blocks the page.
    const timer = setTimeout(() => setTurns(reviewTurns(props.replay, props.level)));
    return () => clearTimeout(timer);
  }, [props.replay, props.level]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (event.key === "ArrowRight") setIndex((i) => Math.min((turns?.length ?? 1) - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turns]);

  if (turns === null) return <p>Reviewing…</p>;
  const turn = turns[index];
  if (turn === undefined) return <p>No moves to review.</p>;
  const { review, state, event, moment } = turn;
  const actorView = playerView(state, review.seat);
  // Hindsight: every card face up, as the review's judgement never is.
  const view: PlayerView = showAll ? { ...actorView, cards: state.cards } : actorView;
  const used = new Set<CardId>(event.type === "clue" ? event.touched : [event.cardId]);

  return (
    <div className="review">
      <div className="review-controls">
        <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ◀ Prev
        </button>
        <span>
          Turn {index + 1} of {turns.length}
        </span>
        <button disabled={index === turns.length - 1} onClick={() => setIndex(index + 1)}>
          Next ▶
        </button>
        <label>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(change) => setShowAll(change.target.checked)}
          />{" "}
          Show all cards
        </label>
      </div>
      <div className="review-body">
        <div>
          <section className={`verdict ${review.move.category}`}>
            <h2>
              {review.seat === you ? "Your move" : `${seatName(you, review.seat)}'s move`}, as{" "}
              {review.seat === you ? "you" : "they"} saw the table
            </h2>
            <p className="move">{describeEvent(you, event, moment)}</p>
            <Judged move={review.move} />
            <p className="rank">
              Ranked {review.rank} of {review.moves} legal moves
            </p>
            {review.alternative !== undefined && (
              <details open={review.rank > 1}>
                <summary>
                  {review.rank > 1 ? "Engine's pick" : "Runner-up"}:{" "}
                  {describeAction(you, actorView, review.alternative.action)}
                </summary>
                <Judged move={review.alternative} />
              </details>
            )}
          </section>
          <Table view={view} you={you} highlight={used} />
        </div>
        <TurnList turns={turns} you={you} index={index} onSelect={setIndex} />
      </div>
    </div>
  );
}

function Judged({ move }: { move: RankedMove }) {
  return (
    <>
      <span className={`badge ${move.category}`}>{CATEGORY[move.category]}</span>
      <ul className="reasons">
        {move.reasons.map((reason, i) => (
          <li key={i}>
            {reason.text}
            {reason.convention !== null && <code> {reason.convention}</code>}
          </li>
        ))}
      </ul>
    </>
  );
}

function TurnList(props: {
  turns: readonly ReviewedTurn[];
  you: Seat;
  index: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="turn-list">
      <h2>Moves</h2>
      <ol>
        {props.turns.map(({ review, event, moment }, i) => (
          <li
            key={i}
            className={[
              i === props.index && "selected",
              review.seat === props.you && "mine",
              review.rank > 1 && "off",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button onClick={() => props.onSelect(i)}>
              <span className={`dot ${review.move.category}`} />
              {describeEvent(props.you, event, moment)}
              {review.rank > 1 && <span className="rank-note"> (#{review.rank})</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
