// The bar for looking back at earlier tables mid-game, with ← and → as shortcuts.
import { history, type PlayerView, type Seat } from "@hanabi/engine";
import type { Level } from "@hanabi/hgroup";
import { useEffect, useMemo } from "react";
import { chops, describeEvent } from "./describe.ts";
import { step } from "./lookback.ts";

export function LookBack(props: {
  /** The live table. */
  view: PlayerView;
  level: Level;
  you: Seat;
  /** How many moves in the table being shown is, or null for the live table. */
  looking: number | null;
  onLook: (looking: number | null) => void;
}) {
  const { view, level, you, looking, onLook } = props;
  const moves = view.log.length;
  const lines = useMemo(() => {
    const moments = history(view);
    const chopIds = chops(view, level);
    return view.log.map((event, i) => describeEvent(you, event, moments[i]!, chopIds[i]));
  }, [view, level, you]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Leave arrow keys alone while typing a note.
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select"))
        return;
      if (document.querySelector("dialog[open]") !== null) return;
      if (event.key === "ArrowLeft") onLook(step(looking, moves, -1));
      if (event.key === "ArrowRight") onLook(step(looking, moves, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [looking, moves, onLook]);

  const yourTurn = view.status !== "over" && view.currentPlayer === you;
  return (
    <div className={looking === null ? "lookback" : "lookback looking"}>
      <button
        disabled={moves === 0 || looking === 0}
        title="Previous move (←)"
        onClick={() => onLook(step(looking, moves, -1))}
      >
        ◀ Back
      </button>
      <span className="lookback-where">
        {looking === null
          ? "Now"
          : looking === 0
            ? `The opening deal, before move 1 of ${moves}`
            : `After move ${looking} of ${moves}: ${lines[looking - 1]}`}
      </span>
      <button
        disabled={looking === null}
        title="Next move (→)"
        onClick={() => onLook(step(looking, moves, 1))}
      >
        Forward ▶
      </button>
      {looking !== null && (
        <button className={yourTurn ? "primary" : undefined} onClick={() => onLook(null)}>
          {yourTurn ? "Back to now: your turn" : "Back to now"}
        </button>
      )}
    </div>
  );
}
