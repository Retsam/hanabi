// Ranking the moves open to a player under H-Group conventions: every legal move, judged from what
// the player knows. See docs/ARCHITECTURE.md ("Decision engine") and docs/conventions/level-1.md.
import {
  type Action,
  type Card,
  type CardId,
  type Clue,
  type GameEvent,
  type PlayerView,
  RANKS,
  type Seat,
} from "@hanabi/engine";
import { applies, type ConventionId, type Level } from "./conventions";
import {
  advance,
  chop,
  type ClueReading,
  connectingCards,
  countsAsClued,
  hasPlayed,
  type Interpretation,
  isClued,
  type Knowledge,
  pending,
  privateKnowledge,
  readGame,
  tableFacts,
} from "./knowledge";
import { clueMatches, sameCard } from "./possibilities";
import { uniqBy } from "./util";

/**
 * How a move stands under the conventions: one the player is obliged to make, one they may make,
 * or one that breaks a convention (or risks a strike). Moves rank by category first.
 */
export type Category = "mandated" | "permitted" | "violates";

/** Why a move got its category or score. */
export interface Reason {
  /** The convention or principle behind it, or null for a rules-level reason such as a misplay. */
  readonly convention: ConventionId | null;
  /** The cards it is about. */
  readonly cards: readonly CardId[];
  /** A default English sentence for it. */
  readonly text: string;
}

/** A legal move, judged. */
export interface RankedMove {
  readonly action: Action;
  readonly category: Category;
  /**
   * A heuristic that orders moves within one category on this turn, higher first. It is not
   * comparable across turns. Among violations it puts the least harmful first: a clue that gets
   * nothing (a stall), then one that means nothing at the table's level, then discards and clues
   * that lose or mislead about cards, and last a play that may strike.
   */
  readonly score: number;
  readonly reasons: readonly Reason[];
  /** For a clue, how the table would read it. */
  readonly reading?: ClueReading;
}

const ORDER: Record<Category, number> = { mandated: 0, permitted: 1, violates: 2 };

/**
 * Every legal move for the viewer, judged at the table's `level` from what the viewer knows, best
 * first: by category, then by score, then in a fixed order (plays, discards, then clues by seat and
 * clue). Deterministic. Empty when the game is over.
 */
export function rankMoves(view: PlayerView, level: Level): RankedMove[] {
  if (view.status === "over") return [];
  const knowledge = readGame(view, level);
  const judge = judgement(view, knowledge);
  const clues = view.clueTokens > 0 ? cluesFor(view).map(judge.clue) : [];
  const anyClue = clues.some((move) => move.category !== "violates");
  const hand = view.hands[view.seat]!;
  const plays = hand.map(judge.play);
  const discards =
    view.clueTokens < view.config.maxClueTokens ? hand.map((id) => judge.discard(id, anyClue)) : [];
  return [...plays, ...discards, ...clues]
    .map((move, i) => ({ move, i }))
    .toSorted((a, b) => {
      const byCategory = ORDER[a.move.category] - ORDER[b.move.category];
      return byCategory || b.move.score - a.move.score || a.i - b.i;
    })
    .map(({ move }) => move);
}

/** Every clue the viewer could give, with the cards it would touch: each seat, each color, each rank. */
function cluesFor(view: PlayerView): { target: Seat; clue: Clue; touched: CardId[] }[] {
  const clues: Clue[] = [
    ...view.config.suits.map((value) => ({ kind: "color", value }) as const),
    ...RANKS.map((value) => ({ kind: "rank", value }) as const),
  ];
  const players = view.config.numPlayers;
  const result = [];
  for (let step = 1; step < players; step++) {
    const target = (view.seat + step) % players;
    for (const clue of clues) {
      const touched = view.hands[target]!.filter((id) => clueMatches(view.cards[id]!.card!, clue));
      if (touched.length > 0) result.push({ target, clue, touched });
    }
  }
  return result;
}

const reason = (convention: ConventionId | null, cards: CardId[], text: string): Reason => ({
  convention,
  cards,
  text,
});

const name = (card: Card) => `${card.suit} ${card.rank}`;
const clueName = (clue: Clue) => (clue.kind === "rank" ? `number ${clue.value}` : clue.value);

/** The judges for each kind of move, sharing what the viewer knows. */
function judgement(view: PlayerView, knowledge: Knowledge) {
  const { level, moment } = knowledge;
  const me = view.seat;
  const facts = tableFacts(view, knowledge);
  const mine = privateKnowledge(view, knowledge);
  const truth = (id: CardId) => view.cards[id]!.card;
  const stack = (card: Card) => moment.stacks[card.suit] ?? 0;
  const playableNow = (card: Card) => card.rank === stack(card) + 1;

  const ownClued = moment.hands[me]!.filter((id) => countsAsClued(knowledge, id));
  /** Clued cards in other hands, which the viewer sees: Good Touch says they will all play. */
  const visibleClued = moment.hands
    .flat()
    .filter((id) => isClued(moment, id) && truth(id) !== null)
    .map((id) => ({ id, card: truth(id)! }));
  const isTrash = (card: Card, self: CardId) =>
    facts.isTrash(card, self) ||
    (applies("good-touch", level) &&
      visibleClued.some((other) => other.id !== self && sameCard(other.card, card)));

  /** Whether some clue's still-possible reading needs `id` to play now as a prompt or finesse. */
  const owed = (id: CardId) =>
    knowledge.readings.some((reading) =>
      pending(reading).some(
        (interpretation) =>
          mine[reading.focus]!.some((card) => sameCard(card, interpretation.focusIdentity)) &&
          interpretation.connections.some(
            (connection) =>
              connection.seat === me &&
              !hasPlayed(moment, connection.card) &&
              connectingCards(knowledge, connection).find((each) =>
                mine[each]!.some((card) => sameCard(card, connection.card)),
              ) === id,
          ),
      ),
    );

  const play = (id: CardId): RankedMove => {
    const action = { type: "play", cardId: id } as const;
    // Checked first: a prompt with several candidates plays the leftmost before its note is pinned.
    // The clue promises the card is there, and its giver answers for the cards played on the way.
    if (owed(id)) {
      const kind = isClued(moment, id) ? "prompt" : "finesse";
      return {
        action,
        category: "mandated",
        score: 100,
        reasons: [reason(kind, [id], `A ${kind} is waiting on this card: play it now.`)],
      };
    }
    const note = mine[id]!;
    if (note.length === 0 || !note.every(playableNow)) {
      return {
        action,
        category: "violates",
        score: -40 - note.filter((card) => !playableNow(card)).length,
        reasons: [reason(null, [id], "The card is not known to be playable, so it may misplay.")],
      };
    }
    return {
      action,
      category: "permitted",
      score: 100,
      reasons: [reason("play-clue", [id], "The card is known to be playable.")],
    };
  };

  const discard = (id: CardId, anyClue: boolean): RankedMove => {
    const action = { type: "discard", cardId: id } as const;
    const note = mine[id]!;
    if (note.length > 0 && note.every((card) => isTrash(card, id))) {
      return {
        action,
        category: "permitted",
        score: 15,
        reasons: [reason("trash", [id], "The card is known trash.")],
      };
    }
    if (countsAsClued(knowledge, id)) {
      return {
        action,
        category: "violates",
        score: -25,
        reasons: [reason("good-touch", [id], "Clued cards will play one day: don't discard them.")],
      };
    }
    if (id !== chop(knowledge, me)) {
      return {
        action,
        category: "violates",
        score: -12,
        reasons: [reason("chop", [id], "Only the chop card is discarded.")],
      };
    }
    const earlyGame = !view.log.some((event) => event.type === "discard");
    if (earlyGame && anyClue && applies("early-game", level)) {
      return {
        action,
        category: "violates",
        score: -3,
        reasons: [
          reason(
            "early-game",
            [id],
            "In the Early Game, every play and save clue is given before anyone discards.",
          ),
        ],
      };
    }
    return {
      action,
      category: "permitted",
      score: 10,
      reasons: [reason("chop", [id], "Discarding chop.")],
    };
  };

  const clue = (given: { target: Seat; clue: Clue; touched: CardId[] }): RankedMove => {
    const { target, touched } = given;
    const action = { type: "clue", target, clue: given.clue } as const;
    const event: GameEvent = { type: "clue", seat: me, ...given };
    const after = advance(view, knowledge, event);
    const reading = after.readings.at(-1)!;
    const said = `${clueName(given.clue)} to seat ${target}`;
    const verdict = (category: Category, score: number, reasons: Reason[]): RankedMove => ({
      action,
      category,
      score,
      reasons,
      reading,
    });

    const live = pending(reading);
    if (live.length === 0) {
      return verdict("violates", -2, [
        reason(null, touched, `Cluing ${said} is neither a play clue nor a save clue.`),
      ]);
    }
    const focusCard = truth(reading.focus)!;
    const real = live.filter((interpretation) => isReal(interpretation, focusCard));
    // How the receiver would read it: what they see, except their own hand. The viewer can't see
    // their own hand either, so those cards count as anything the viewer thinks they could be.
    const seen = receiverKnowledge(view, after, mine, target);
    const kept = live.filter((interpretation) =>
      seen[reading.focus]!.some((card) => sameCard(card, interpretation.focusIdentity)),
    );
    if (real.length === 0 || !kept.some((interpretation) => real.includes(interpretation))) {
      const misread = uniqueNames(kept.length > 0 ? kept : live);
      return verdict("violates", -30, [
        reason(
          null,
          [reading.focus],
          `Cluing ${said} would be read as ${misread}, but the card is the ${name(focusCard)}.`,
        ),
      ]);
    }

    const reasons: Reason[] = [];
    const saving = real.some((interpretation) => interpretation.kind === "save");
    const primary = real.find((interpretation) => interpretation.kind === "save") ?? real[0]!;
    const { conventions } = primary;
    reasons.push(
      reason(
        mainConvention(primary),
        [reading.focus],
        `Cluing ${said} is a ${saving ? "save" : "play"} clue on the ${name(focusCard)}.`,
      ),
    );

    // The 2 Save's Visible Rule: no 2 Save when the other copy is in someone else's hand, unless
    // it is on their chop too.
    if (conventions.includes("2-save")) {
      const twin = moment.hands.findIndex(
        (hand, seat) =>
          seat !== target &&
          hand.some((id) => truth(id) !== null && sameCard(truth(id)!, focusCard)),
      );
      const twinChop = twin === -1 ? null : chop(knowledge, twin);
      const twinOnChop =
        twinChop !== null && truth(twinChop) !== null && sameCard(truth(twinChop)!, focusCard);
      if (twin !== -1 && !twinOnChop) {
        return verdict("violates", -5, [
          ...reasons,
          reason(
            "2-save",
            [reading.focus],
            `The other ${name(focusCard)} is visible in another hand, so it can't be 2 Saved.`,
          ),
        ]);
      }
    }

    const newlyTouched = touched.filter((id) => !countsAsClued(knowledge, id));
    const bad = newlyTouched.filter((id, i) => {
      const card = truth(id)!;
      return (
        isTrash(card, id) || newlyTouched.slice(0, i).some((other) => sameCard(truth(other)!, card))
      );
    });
    const gotten = newlyTouched.filter((id) => !bad.includes(id));
    if (gotten.length === 0 && applies("minimum-clue-value", level)) {
      return verdict("violates", -1, [
        ...reasons,
        reason(
          "minimum-clue-value",
          touched,
          "The clue gets no new card: every clue must get at least one new card played or saved.",
        ),
      ]);
    }
    let score = 10 * gotten.length;
    score += 5 * real[0]!.connections.length;
    if (playableNow(focusCard) && !saving) score += 10;
    if (view.clueTokens === 1) score -= 5;
    // The viewer can't see their own clued cards, so a card the clue gets may be one of them.
    const risky = gotten.filter((id) =>
      ownClued.some((own) => mine[own]!.some((card) => sameCard(card, truth(id)!))),
    );
    if (risky.length > 0 && applies("good-touch", level)) {
      const copy = reason(
        "good-touch",
        risky,
        `${risky.map((id) => `The ${name(truth(id)!)}`).join(" and ")} may be a copy of one of your own clued cards.`,
      );
      // A play clue that may duplicate a clued card is a Good Touch mistake (the site's Sarcastic
      // Discard example), so it's a last resort. A save still goes ahead: the Save Principle wins.
      if (!saving) return verdict("violates", -4 - risky.length, [...reasons, copy]);
      score -= 5 * risky.length;
      reasons.push(copy);
    }

    if (bad.length > 0 && applies("good-touch", level)) {
      const text = `It also touches ${bad.map((id) => `the ${name(truth(id)!)}`).join(" and ")}, which is trash.`;
      if (!saving)
        return verdict("violates", -15 - 5 * bad.length, [
          ...reasons,
          reason("good-touch", bad, text),
        ]);
      // Saving a card that must not be lost outweighs Good Touch.
      score -= 10 * bad.length;
      reasons.push(reason("good-touch", bad, `${text} The save is worth it.`));
    }

    if (urgentSave(view, knowledge, mine, target, reading.focus)) {
      reasons.push(
        reason(
          "save-principle",
          [reading.focus],
          `The next player would discard the ${name(focusCard)} from chop: it must be saved.`,
        ),
      );
      return verdict("mandated", score + 30, reasons);
    }
    return verdict("permitted", score, reasons);
  };

  /**
   * Whether `interpretation` is the truth as the viewer sees it: the focus is the card it says,
   * and every connecting card is where it says (the leftmost candidate, for a prompt).
   */
  function isReal(interpretation: Interpretation, focusCard: Card): boolean {
    if (!sameCard(interpretation.focusIdentity, focusCard)) return false;
    return interpretation.connections.every((connection) => {
      if (hasPlayed(moment, connection.card)) return true;
      const id = connectingCards(knowledge, connection)[0];
      const card = id === undefined ? null : truth(id);
      return card !== null && sameCard(card, connection.card);
    });
  }

  return { play, discard, clue };
}

const uniqueNames = (interpretations: readonly Interpretation[]) =>
  uniqBy(
    interpretations.map((interpretation) => interpretation.focusIdentity),
    sameCard,
  )
    .map((card) => `the ${name(card)}`)
    .join(" or ");

const SAVES: readonly ConventionId[] = ["5-save", "2-save", "critical-save"];

/**
 * The convention a clue read as `interpretation` is an example of: its prompt or finesse, its kind
 * of save, or a (delayed) play clue.
 */
function mainConvention(interpretation: Interpretation): ConventionId {
  const [connection] = interpretation.connections;
  if (connection !== undefined) return connection.kind;
  const { conventions } = interpretation;
  if (interpretation.kind === "save") {
    return conventions.find((id) => SAVES.includes(id)) ?? "save-clue";
  }
  return conventions.includes("delayed-play-clue") ? "delayed-play-clue" : "play-clue";
}

/**
 * What the clue receiver would know after the clue: they see every card the viewer sees except
 * their own hand, and the viewer's own cards, which count as anything the viewer thinks they
 * could be.
 */
function receiverKnowledge(
  view: PlayerView,
  after: Knowledge,
  mine: readonly (readonly Card[])[],
  receiver: Seat,
): (readonly Card[])[] {
  const theirs = new Set(after.moment.hands[receiver]);
  const ours = new Set(after.moment.hands[view.seat]);
  const cards = view.cards.map((card) => (theirs.has(card.id) ? { ...card, card: null } : card));
  const common = after.common.map((note, id) => {
    if (!ours.has(id)) return note;
    const narrowed = note.filter((card) => mine[id]!.some((other) => sameCard(other, card)));
    return narrowed.length > 0 ? narrowed : note;
  });
  return privateKnowledge({ config: view.config, cards }, { ...after, common });
}

/**
 * Whether `id` is a card the Save Principle protects on the next player's chop, with nothing else
 * for them to do first: no card the table knows is playable and no known trash to discard.
 */
function urgentSave(
  view: PlayerView,
  knowledge: Knowledge,
  mine: readonly (readonly Card[])[],
  target: Seat,
  id: CardId,
): boolean {
  const { level, moment } = knowledge;
  if (!applies("save-principle", level)) return false;
  if (target !== (view.seat + 1) % view.config.numPlayers || id !== chop(knowledge, target)) {
    return false;
  }
  const card = view.cards[id]!.card!;
  const facts = tableFacts(view, knowledge);
  const stack = moment.stacks[card.suit] ?? 0;
  const visible = (other: Card) =>
    moment.hands.some((hand, seat) =>
      hand.some((cardId) => {
        if (cardId === id) return false;
        const seen = view.cards[cardId]!.card;
        if (seen !== null) return sameCard(seen, other);
        // The viewer's own cards count only where the viewer knows them.
        return (
          seat === view.seat && mine[cardId]!.length === 1 && sameCard(mine[cardId]![0]!, other)
        );
      }),
    );
  const protectedCard =
    !facts.isTrash(card, id) &&
    (card.rank === 5 ||
      facts.isCritical(card) ||
      (card.rank === 2 && !visible(card)) ||
      (card.rank === stack + 1 && !visible(card)));
  if (!protectedCard) return false;
  const busy = moment.hands[target]!.some((other) => {
    const note = knowledge.common[other]!;
    return (
      countsAsClued(knowledge, other) &&
      (note.every((c) => c.rank === (moment.stacks[c.suit] ?? 0) + 1) ||
        note.every((c) => facts.isTrash(c, other)))
    );
  });
  return !busy;
}
