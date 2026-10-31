import { type Card, type CardId, type PlayerView, RANKS } from "@hanabi/engine";
import { cluePossibilities } from "@hanabi/hgroup";
import { type ReactNode, useEffect, useRef } from "react";
import {
  type CardNote,
  EMPTY_NOTE,
  identityKey,
  markedPossibilities,
  toggleIdentity,
} from "./notes.ts";

/**
 * A card in a hand. Shows its face when the viewer can see it; otherwise whatever its clues and the
 * player's notes pin down. Underneath, the suits and ranks still possible: what its holder knows from
 * clues, less anything the player has crossed off, with a star when the card has a written note.
 */
export function HandCard(props: {
  view: PlayerView;
  id: CardId;
  /** Marks the card, for example as touched by the clue being considered. */
  highlight?: boolean;
  /** The player's note on the card. */
  note?: CardNote | undefined;
  /** Opens the card's notes. Without it the card can't be clicked. */
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const { view, id, note, onOpen } = props;
  const { card, clues } = view.cards[id]!;
  const possible = markedPossibilities(cluePossibilities(view.config, clues), note);
  const suits = view.config.suits.filter((suit) => possible.some((each) => each.suit === suit));
  const ranks = RANKS.filter((rank) => possible.some((each) => each.rank === rank));
  const suit = card?.suit ?? (suits.length === 1 ? suits[0] : undefined);
  const rank = card?.rank ?? (ranks.length === 1 ? ranks[0] : undefined);
  const classes = [
    "card",
    suit === undefined ? "suit-unknown" : `suit-${suit}`,
    card === null && "hidden",
    clues.touchedBy.length > 0 && "clued",
    props.highlight === true && "highlight",
  ];
  const face = rank ?? (card === null ? "?" : "");
  const written = note !== undefined && note.text.trim() !== "";
  return (
    <div className="slot">
      {onOpen === undefined ? (
        <div className={classes.filter(Boolean).join(" ")}>{face}</div>
      ) : (
        <button
          className={classes.filter(Boolean).join(" ")}
          title="Notes: cross off what it can't be"
          onClick={onOpen}
        >
          {face}
        </button>
      )}
      <div
        className="pips"
        title={written ? note.text : "What its holder knows from clues, less what you crossed off"}
      >
        <span>
          {suits.map((each) => (
            <span key={each} className={`pip suit-${each}`} />
          ))}
          {written && <span className="note-star">*</span>}
        </span>
        <span>{ranks.join("")}</span>
      </div>
      {props.children}
    </div>
  );
}

/**
 * The player's notes on one card, in a modal: a suit-by-rank grid to cross identities off (ones its
 * clues already rule out can't be picked) and a free-text note.
 */
export function NoteEditor(props: {
  view: PlayerView;
  id: CardId;
  note: CardNote | undefined;
  onChange: (note: CardNote) => void;
  onClose: () => void;
}) {
  const { view, id, onChange } = props;
  const note = props.note ?? EMPTY_NOTE;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const allowed = new Set(cluePossibilities(view.config, view.cards[id]!.clues).map(identityKey));
  const cell = (card: Card) => {
    const key = identityKey(card);
    const crossed = note.crossedOff.includes(key);
    return (
      <button
        key={key}
        className={`identity suit-${card.suit}${crossed ? " crossed" : ""}`}
        disabled={!allowed.has(key)}
        aria-pressed={crossed}
        aria-label={`${card.suit} ${card.rank}${crossed ? ", crossed off" : ""}`}
        onClick={() => onChange(toggleIdentity(note, card))}
      >
        {card.rank}
      </button>
    );
  };
  return (
    <dialog ref={dialog} className="note-editor" onClose={props.onClose}>
      <h3>Card notes</h3>
      <p>Click an identity to cross it off, or back on.</p>
      <div className="identities">
        {view.config.suits.map((suit) => (
          <div key={suit} className="identity-row">
            {RANKS.map((rank) => cell({ suit, rank }))}
          </div>
        ))}
      </div>
      <label>
        Note
        <textarea
          rows={3}
          value={note.text}
          onChange={(event) => onChange({ ...note, text: event.target.value })}
        />
      </label>
      <div className="buttons">
        <button
          disabled={note.crossedOff.length === 0}
          onClick={() => onChange({ ...note, crossedOff: [] })}
        >
          Clear marks
        </button>
        <button onClick={() => dialog.current?.close()}>Done</button>
      </div>
    </dialog>
  );
}
