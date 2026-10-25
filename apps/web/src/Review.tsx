// The review screen: step through a finished game, seeing each move from its player's view with how
// the decision engine judged it and what it would have done instead.
import { type CardId, playerView, type PlayerView, type Replay, type Seat } from "@hanabi/engine";
import type { Category, Level, RankedMove } from "@hanabi/hgroup";
import { useEffect, useState } from "react";
import { describeAction, describeEvent, seatName } from "./describe.ts";
import { type ReviewedTurn, reviewTurns, type Standing, standing } from "./review.ts";
import { Table } from "./Table.tsx";

/**
 * Whose eyes the table is shown through: the player who made the move, the player after them, or
 * everyone's cards face up.
 */
type Pov = "mover" | "next" | "all";
const POVS: readonly Pov[] = ["mover", "next", "all"];

const CATEGORY: Record<Category, string> = {
  mandated: "Mandated",
  permitted: "Permitted",
  violates: "Violates",
};

export function Review(props: { replay: Replay; level: Level; you: Seat }) {
  const { you } = props;
  const [turns, setTurns] = useState<ReviewedTurn[] | null>(null);
  const [index, setIndex] = useState(0);
  const [pov, setPov] = useState<Pov>("mover");

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
  const { review, state, event, moment, chop } = turn;
  const actorView = playerView(state, review.seat);
  const next = (review.seat + 1) % state.config.numPlayers;
  const view: PlayerView =
    pov === "mover"
      ? actorView
      : pov === "next"
        ? playerView(state, next)
        : // Hindsight: every card face up, as the review's judgement never is.
          { ...actorView, cards: state.cards };
  const povLabels: Record<Pov, string> = {
    mover: `Mover (${seatName(you, review.seat)})`,
    next: `Next (${seatName(you, next)})`,
    all: "All cards",
  };
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
        <div className="pov" role="radiogroup" aria-label="Point of view">
          {POVS.map((each) => (
            <button
              key={each}
              role="radio"
              aria-checked={pov === each}
              className={pov === each ? "selected" : ""}
              onClick={() => setPov(each)}
            >
              {povLabels[each]}
            </button>
          ))}
        </div>
      </div>
      <div className="review-body">
        <div>
          <section className={`verdict ${review.move.category} ${standing(review)}`}>
            <h2>
              {review.seat === you ? "Your move" : `${seatName(you, review.seat)}'s move`}, as{" "}
              {review.seat === you ? "you" : "they"} saw the table
            </h2>
            <p className="move">{describeEvent(you, event, moment, chop)}</p>
            <Judged move={review.move} />
            <p className="rank">
              Ranked {review.rank} of {review.moves} legal moves
              {standing(review) === "forced" && ", so every move breaks a convention"}
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
          <Table view={view} level={props.level} you={you} highlight={used} />
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

const STANDING: Record<Standing, string> = {
  best: "Top move",
  forced: "Top move, but a violation",
  close: "Not top, same category",
  worse: "Worse category than top",
};

/** What the move list's colors and marks mean, opened from the "?" button. */
function MovesHelp() {
  return (
    <div id="moves-help" className="moves-help" popover="auto">
      <h3>Reading the move list</h3>
      <p>The dot is the move's category, judged from what its player could see:</p>
      <ul>
        <li>
          <span className="dot mandated" /> Mandated: a move the conventions require
        </li>
        <li>
          <span className="dot permitted" /> Permitted: allowed, ranked by how useful it is
        </li>
        <li>
          <span className="dot violates" /> Violates: breaks a convention
        </li>
        <li>
          <span className="dot forced" /> The engine's top move, though it breaks a convention:
          every legal move did
        </li>
      </ul>
      <p>The text color compares the move with the engine's top pick:</p>
      <ul>
        <li className="close">Orange: not the top move, but in the same category</li>
        <li className="worse">Red: in a worse category than the top move</li>
      </ul>
      <p>Marks:</p>
      <ul>
        <li>
          <strong>(#3)</strong>: where the move ranked among the legal moves
        </li>
        <li>
          <strong>(!)</strong>: a discard of a card that wasn't the player's chop
        </li>
        <li>
          <strong>Bold</strong>: your moves
        </li>
      </ul>
      <button popoverTarget="moves-help" popoverTargetAction="hide">
        Close
      </button>
    </div>
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
      <div className="turn-list-head">
        <h2>Moves</h2>
        <button className="help" popoverTarget="moves-help" aria-label="What the colors mean">
          ?
        </button>
      </div>
      <MovesHelp />
      <ol>
        {props.turns.map(({ review, event, moment, chop }, i) => (
          <li
            key={i}
            className={[
              i === props.index && "selected",
              review.seat === props.you && "mine",
              standing(review),
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button onClick={() => props.onSelect(i)} title={STANDING[standing(review)]}>
              <span className={`dot ${review.move.category} ${standing(review)}`} />
              {describeEvent(props.you, event, moment, chop)}
              {review.rank > 1 && <span className="rank-note"> (#{review.rank})</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
