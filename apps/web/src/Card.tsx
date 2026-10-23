import type { CardId, PlayerView } from "@hanabi/engine";
import { cluePossibilities } from "@hanabi/hgroup";
import type { ReactNode } from "react";

/**
 * A card in a hand. Shows its face when the viewer can see it; otherwise whatever its clues pin down.
 * Underneath, the suits and ranks its clues still allow: what its holder knows about it.
 */
export function HandCard(props: {
  view: PlayerView;
  id: CardId;
  /** Marks the card, for example as touched by the clue being considered. */
  highlight?: boolean;
  children?: ReactNode;
}) {
  const { view, id } = props;
  const { card, clues } = view.cards[id]!;
  const possible = cluePossibilities(view.config, clues);
  const suits = view.config.suits.filter((suit) => possible.some((each) => each.suit === suit));
  const ranks = [1, 2, 3, 4, 5].filter((rank) => possible.some((each) => each.rank === rank));
  const suit = card?.suit ?? (suits.length === 1 ? suits[0] : undefined);
  const rank = card?.rank ?? (ranks.length === 1 ? ranks[0] : undefined);
  const classes = [
    "card",
    suit === undefined ? "suit-unknown" : `suit-${suit}`,
    card === null && "hidden",
    clues.touchedBy.length > 0 && "clued",
    props.highlight === true && "highlight",
  ];
  return (
    <div className="slot">
      <div className={classes.filter(Boolean).join(" ")}>{rank ?? (card === null ? "?" : "")}</div>
      <div className="pips" title="What its holder knows from clues">
        <span>
          {suits.map((each) => (
            <span key={each} className={`pip suit-${each}`} />
          ))}
        </span>
        <span>{ranks.join("")}</span>
      </div>
      {props.children}
    </div>
  );
}
