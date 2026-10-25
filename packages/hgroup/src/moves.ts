// Ranking the moves open to a player under H-Group conventions: every legal move, judged from what
// the player knows. See docs/ARCHITECTURE.md ("Decision engine") and docs/conventions/level-1.md.
import {
  type Action,
  type Card,
  type CardId,
  type Clue,
  type PlayerView,
  RANKS,
  type Seat,
} from "@hanabi/engine";
import { applies, type ConventionId, type Level } from "./conventions.ts";
import {
  advance,
  chop,
  type ClueReading,
  connectingCards,
  countsAsClued,
  type GivenClue,
  hasPlayed,
  type Interpretation,
  isClued,
  isPlayable,
  type Knowledge,
  pending,
  privateKnowledge,
  readGame,
  tableFacts,
  type Table,
  type TableFacts,
} from "./knowledge.ts";
import { clueMatches, sameCard } from "./possibilities.ts";
import { couldBe, identity, narrowed, type Note } from "./notes.ts";
import { seatsAfter, uniqBy } from "./util.ts";

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
  const judge = judgeFor(view, readGame(view, level));
  const clues = view.clueTokens > 0 ? cluesFor(view).map((given) => judgeClue(judge, given)) : [];
  const anyClue = clues.some((move) => move.category !== "violates");
  const hand = view.hands[view.seat]!;
  const plays = hand.map((id) => judgePlay(judge, id));
  const discards =
    view.clueTokens < view.config.maxClueTokens
      ? hand.map((id) => judgeDiscard(judge, id, anyClue))
      : [];
  return [...plays, ...discards, ...clues]
    .map((move, i) => ({ move, i }))
    .toSorted((a, b) => {
      const byCategory = ORDER[a.move.category] - ORDER[b.move.category];
      return byCategory || b.move.score - a.move.score || a.i - b.i;
    })
    .map(({ move }) => move);
}

/** Every clue the viewer could give, with the cards it would touch: each seat, each color, each rank. */
function cluesFor(view: PlayerView): Given[] {
  const clues: Clue[] = [
    ...view.config.suits.map((value) => ({ kind: "color", value }) as const),
    ...RANKS.map((value) => ({ kind: "rank", value }) as const),
  ];
  const result = [];
  for (const target of seatsAfter(view.seat, view.config.numPlayers)) {
    for (const clue of clues) {
      const touched = view.hands[target]!.filter((id) => clueMatches(view.cards[id]!.card!, clue));
      if (touched.length > 0) result.push({ target, clue, touched });
    }
  }
  return result;
}

/** A clue the viewer could give: to whom, and the cards it would touch. */
type Given = Omit<GivenClue, "giver">;

const reason = (
  convention: ConventionId | null,
  cards: readonly CardId[],
  text: string,
): Reason => ({
  convention,
  cards,
  text,
});

const name = (card: Card) => `${card.suit} ${card.rank}`;
const clueName = (clue: Clue) => (clue.kind === "rank" ? `number ${clue.value}` : clue.value);

/** What the viewer knows on this turn, shared by every judgement. */
interface Judge {
  readonly view: PlayerView;
  readonly knowledge: Knowledge;
  readonly facts: TableFacts;
  /** What the viewer knows about each card (`privateKnowledge`). */
  readonly mine: readonly Note[];
  /** Whether a convention is in force at the table's level. */
  readonly uses: (convention: ConventionId) => boolean;
  /** A card's identity, or null if the viewer can't see it. */
  readonly seen: (id: CardId) => Card | null;
  /** Trash to the table, or a copy of a clued card the viewer sees, which Good Touch says will play. */
  readonly isTrash: (card: Card, self: CardId) => boolean;
  /** The card on the next player's chop that must be saved this turn, if any (`urgentSave`). */
  readonly urgent: CardId | null;
}

function judgeFor(view: PlayerView, knowledge: Knowledge): Judge {
  const facts = tableFacts(view, knowledge);
  const uses = (convention: ConventionId) => applies(convention, knowledge.level);
  const seen = (id: CardId) => view.cards[id]!.card;
  const isTrash = trashTest(view, knowledge);
  const mine = privateKnowledge(view, knowledge);
  const judge = { view, knowledge, facts, mine, uses, seen, isTrash };
  return { ...judge, urgent: urgentSave(judge) };
}

/** `Judge.isTrash` on `table`. Bad-touched cards are trash, so they make no other card a copy. */
function trashTest(view: PlayerView, table: Table): Judge["isTrash"] {
  const { moment } = table;
  const facts = tableFacts(view, table);
  const visibleClued = moment.hands
    .flat()
    .filter((id) => isClued(moment, id) && !table.badTouched.includes(id))
    .flatMap((id) => {
      const card = view.cards[id]!.card;
      return card ? [{ id, card }] : [];
    });
  return (card: Card, self: CardId) =>
    facts.isTrash(card, self) ||
    (applies("good-touch", table.level) &&
      visibleClued.some((other) => other.id !== self && sameCard(other.card, card)));
}

const move = (
  action: Action,
  category: Category,
  score: number,
  reasons: Reason[],
  reading?: ClueReading,
): RankedMove => ({ action, category, score, reasons, ...(reading && { reading }) });

function judgePlay(judge: Judge, id: CardId): RankedMove {
  const action = { type: "play", cardId: id } as const;
  const { moment } = judge.knowledge;
  const playable = (card: Card) => isPlayable(moment, card);
  // Checked first: a prompt with several candidates plays the leftmost before its note is pinned.
  // The clue promises the card is there, and its giver answers for the cards played on the way.
  if (owes(judge.knowledge, judge.mine, judge.view.seat, id)) {
    const kind = isClued(moment, id) ? "prompt" : "finesse";
    return move(action, "mandated", 100, [
      reason(kind, [id], `A ${kind} is waiting on this card: play it now.`),
    ]);
  }
  const note = judge.mine[id]!;
  if (note.length === 0 || !note.every(playable)) {
    return move(action, "violates", -40 - note.filter((card) => !playable(card)).length, [
      reason(null, [id], "The card is not known to be playable, so it may misplay."),
    ]);
  }
  return move(action, "permitted", 100, [
    reason("play-clue", [id], "The card is known to be playable."),
  ]);
}

/**
 * Whether some clue's still-possible reading needs `seat` to play `id` now as a prompt or finesse,
 * as far as `seat` can tell from `known`, what they know.
 */
function owes(
  knowledge: Knowledge,
  known: readonly Note[],
  seat: Seat,
  id: CardId,
  readings: readonly ClueReading[] = knowledge.readings,
): boolean {
  return readings.some((reading) => {
    // Only where every reading the seat can't rule out needs the card: a self-prompt that may be
    // a direct play clue owes nothing yet.
    const live = pending(reading).filter(
      (interpretation) =>
        couldBe(known[reading.focus]!, interpretation.focusIdentity) &&
        interpretation.connections.every(
          (connection) =>
            hasPlayed(knowledge.moment, connection.card) ||
            connectingCards(knowledge, connection).some((each) =>
              couldBe(known[each]!, connection.card),
            ),
        ),
    );
    return (
      live.length > 0 &&
      live.every((interpretation) =>
        interpretation.connections.some(
          (connection) =>
            connection.seat === seat &&
            // A prompt can wait on a clued card the table knows will play first.
            isPlayable(knowledge.moment, connection.card) &&
            connectingCards(knowledge, connection).find((each) =>
              couldBe(known[each]!, connection.card),
            ) === id,
        ),
      )
    );
  });
}

function judgeDiscard(judge: Judge, id: CardId, anyClue: boolean): RankedMove {
  const action = { type: "discard", cardId: id } as const;
  const { knowledge, view } = judge;
  const note = judge.mine[id]!;
  if (note.length > 0 && note.every((card) => judge.isTrash(card, id))) {
    return move(action, "permitted", 15, [reason("trash", [id], "The card is known trash.")]);
  }
  if (countsAsClued(knowledge, id)) {
    return move(action, "violates", -25, [
      reason("good-touch", [id], "Clued cards will play one day: don't discard them."),
    ]);
  }
  if (id !== chop(knowledge, view.seat)) {
    return move(action, "violates", -12, [
      reason("chop", [id], "Only the chop card is discarded."),
    ]);
  }
  const earlyGame = !view.log.some((event) => event.type === "discard");
  if (earlyGame && anyClue && judge.uses("early-game")) {
    return move(action, "violates", -3, [
      reason(
        "early-game",
        [id],
        "In the Early Game, every play and save clue is given before anyone discards.",
      ),
    ]);
  }
  return move(action, "permitted", 10, [reason("chop", [id], "Discarding chop.")]);
}

/** A clue that means what the viewer intends, as the viewer sees it. */
interface ClueCase extends Given {
  readonly focus: CardId;
  /** What the focus really is. */
  readonly focusCard: Card;
  /** The interpretations that are true, as the viewer sees the cards. Never empty. */
  readonly real: readonly Interpretation[];
  /** The interpretation the clue is mainly an example of: a save if it can be one. */
  readonly primary: Interpretation;
  readonly saving: boolean;
  /** Newly touched cards that are trash, or a copy of a card touched before them. */
  readonly bad: readonly CardId[];
  /** Newly touched cards the clue gets played or saved. */
  readonly gotten: readonly CardId[];
  /** What the table knows once the clue is given. */
  readonly after: Knowledge;
}

/** What a check finds: a convention the clue breaks, or a change to its score. */
type Finding =
  | { readonly violates: number; readonly reason: Reason }
  | { readonly score: number; readonly reason: Reason; readonly mandated?: true };

/**
 * The checks a clue that means what the viewer intends goes through, in order. The first violation
 * decides the clue; the other findings add up.
 */
const CLUE_CHECKS: readonly ((judge: Judge, clue: ClueCase) => Finding | undefined)[] = [
  twoSaveVisibleRule,
  minimumClueValue,
  copiesOwnClued,
  badTouch,
  finesseSeen,
  savePrinciple,
  playOverSave,
];

function judgeClue(judge: Judge, given: Given): RankedMove {
  const { view, knowledge } = judge;
  const action = { type: "clue", target: given.target, clue: given.clue } as const;
  const after = advance(view, knowledge, { type: "clue", seat: view.seat, ...given });
  const reading = after.readings.at(-1)!;
  const said = `${clueName(given.clue)} to seat ${given.target}`;
  const verdict = (category: Category, score: number, reasons: Reason[]) =>
    move(action, category, score, reasons, reading);

  const live = pending(reading);
  if (live.length === 0) {
    return verdict("violates", -2, [
      reason(null, given.touched, `Cluing ${said} is neither a play clue nor a save clue.`),
    ]);
  }
  const focusCard = judge.seen(reading.focus)!;
  const real = live.filter((interpretation) => isReal(judge, interpretation, focusCard));
  const kept = receiverKeeps(judge, after, given.target);
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

  const clue = describeClue(judge, given, after, reading.focus, real);
  const reasons = [
    reason(
      mainConvention(clue.primary),
      [clue.focus],
      `Cluing ${said} is a ${clue.saving ? "save" : "play"} clue on the ${name(focusCard)}.`,
    ),
  ];
  let score = clueValue(judge, clue);
  let category: Category = "permitted";
  for (const check of CLUE_CHECKS) {
    const finding = check(judge, clue);
    if (finding === undefined) continue;
    if ("violates" in finding) {
      return verdict("violates", finding.violates, [...reasons, finding.reason]);
    }
    score += finding.score;
    reasons.push(finding.reason);
    if (finding.mandated) category = "mandated";
  }
  return verdict(category, score, reasons);
}

const isSave = (interpretation: Interpretation) => interpretation.kind === "save";

function describeClue(
  judge: Judge,
  given: Given,
  after: Knowledge,
  focus: CardId,
  real: readonly Interpretation[],
): ClueCase {
  const { knowledge, seen } = judge;
  // A clue that is only real if a save touched a card as trash gets what that card was said to be.
  const trashed = real.every((interpretation) => interpretation.badTouch)
    ? uniqBy(real.flatMap((interpretation) => interpretation.badTouch!))
    : [];
  const isTrash =
    trashed.length === 0
      ? judge.isTrash
      : trashTest(judge.view, {
          ...knowledge,
          badTouched: [...knowledge.badTouched, ...trashed],
        });
  const newlyTouched = given.touched.filter((id) => !countsAsClued(knowledge, id));
  const bad = newlyTouched.filter((id, i) => {
    const card = seen(id)!;
    return (
      isTrash(card, id) || newlyTouched.slice(0, i).some((other) => sameCard(seen(other)!, card))
    );
  });
  return {
    ...given,
    focus,
    focusCard: seen(focus)!,
    real,
    primary: real.find(isSave) ?? real[0]!,
    saving: real.some(isSave),
    bad,
    gotten: newlyTouched.filter((id) => !bad.includes(id)),
    after,
  };
}

/**
 * What a clue is worth before the checks: each card it gets, each connection, a card to play now;
 * less if it spends the last clue token.
 */
function clueValue(judge: Judge, clue: ClueCase): number {
  let score = 10 * clue.gotten.length + 5 * clue.real[0]!.connections.length;
  if (isPlayable(judge.knowledge.moment, clue.focusCard) && !clue.saving) score += 10;
  if (judge.view.clueTokens === 1) score -= 5;
  return score;
}

/** The 2 Save's Visible Rule: no 2 Save when the other copy is in someone else's hand, unless it
 * is on their chop too. */
function twoSaveVisibleRule(judge: Judge, clue: ClueCase): Finding | undefined {
  if (!clue.primary.conventions.includes("2-save")) return undefined;
  const { knowledge, seen } = judge;
  const isTwin = (id: CardId | null) => {
    const card = id === null ? null : seen(id);
    return card !== null && sameCard(card, clue.focusCard);
  };
  const twin = knowledge.moment.hands.findIndex(
    (hand, seat) => seat !== clue.target && hand.some(isTwin),
  );
  if (twin === -1 || isTwin(chop(knowledge, twin))) return undefined;
  const text = `The other ${name(clue.focusCard)} is visible in another hand, so it can't be 2 Saved.`;
  return { violates: -5, reason: reason("2-save", [clue.focus], text) };
}

/** Minimum Clue Value: every clue gets at least one new card played or saved. */
function minimumClueValue(judge: Judge, clue: ClueCase): Finding | undefined {
  if (clue.gotten.length > 0 || !judge.uses("minimum-clue-value")) return undefined;
  const text =
    "The clue gets no new card: every clue must get at least one new card played or saved.";
  return { violates: -1, reason: reason("minimum-clue-value", clue.touched, text) };
}

/**
 * Good Touch, for the cards the viewer can't see: a card the clue gets may be a copy of one of the
 * viewer's own clued cards.
 */
function copiesOwnClued(judge: Judge, clue: ClueCase): Finding | undefined {
  if (!judge.uses("good-touch")) return undefined;
  const { knowledge, mine, seen, view } = judge;
  const ownClued = knowledge.moment.hands[view.seat]!.filter((id) => countsAsClued(knowledge, id));
  const risky = clue.gotten.filter((id) => ownClued.some((own) => couldBe(mine[own]!, seen(id)!)));
  if (risky.length === 0) return undefined;
  const cards = risky.map((id) => `The ${name(seen(id)!)}`).join(" and ");
  const found = reason(
    "good-touch",
    risky,
    `${cards} may be a copy of one of your own clued cards.`,
  );
  // A play clue that may duplicate a clued card is a Good Touch mistake (the site's Sarcastic
  // Discard example), so it's a last resort. A save still goes ahead: the Save Principle wins.
  return clue.saving
    ? { score: -5 * risky.length, reason: found }
    : { violates: -4 - risky.length, reason: found };
}

/**
 * A finesse only works if the finessed player can tell they must blind-play: every reading they
 * can't rule out from what they see needs their finesse position.
 */
function finesseSeen(judge: Judge, clue: ClueCase): Finding | undefined {
  const reading = clue.after.readings.at(-1)!;
  const finesses = clue.real.map((interpretation) =>
    interpretation.connections.filter(({ kind }) => kind === "finesse"),
  );
  // A clue that is also true without a blind-play (a save, say) works either way.
  if (finesses.some((each) => each.length === 0)) return undefined;
  const blind = finesses.flat();
  const lost = blind.find(
    ({ seat, ids }) =>
      !owes(clue.after, seatKnows(judge, clue.after, seat), seat, ids[0]!, [reading]),
  );
  if (lost === undefined) return undefined;
  const text = `Seat ${lost.seat} can't tell they must blind-play the ${name(lost.card)}.`;
  return { violates: -30, reason: reason("finesse", [lost.ids[0]!], text) };
}

/** Good Touch: the clue touches no trash, unless it saves a card that must not be lost. */
function badTouch(judge: Judge, clue: ClueCase): Finding | undefined {
  const { bad } = clue;
  if (bad.length === 0 || !judge.uses("good-touch")) return undefined;
  const cards = bad.map((id) => `the ${name(judge.seen(id)!)}`).join(" and ");
  const text = `It also touches ${cards}, which is trash.`;
  if (!clue.saving)
    return { violates: -15 - 5 * bad.length, reason: reason("good-touch", bad, text) };
  // Saving a card that must not be lost outweighs Good Touch.
  return {
    score: -10 * bad.length,
    reason: reason("good-touch", bad, `${text} The save is worth it.`),
  };
}

/** The Save Principle: a card about to be discarded from the next player's chop must be saved. */
function savePrinciple(judge: Judge, clue: ClueCase): Finding | undefined {
  if (clue.target !== nextSeat(judge.view) || clue.focus !== judge.urgent) return undefined;
  const text = `The next player would discard the ${name(clue.focusCard)} from chop: it must be saved.`;
  return { score: 30, mandated: true, reason: reason("save-principle", [clue.focus], text) };
}

/**
 * Give Play Clues Over Save Clues (beginner/other-general-strategy): a clue that leaves the next
 * player a card to play keeps them from discarding the card on their chop, so it does the save's job
 * this turn. It scores above the save itself.
 */
function playOverSave(judge: Judge, clue: ClueCase): Finding | undefined {
  const id = judge.urgent;
  if (id === null || clue.touched.includes(id)) return undefined;
  if (!isBusy(judge, clue.after, nextSeat(judge.view))) return undefined;
  const text = `The next player will play instead of discarding the ${name(judge.seen(id)!)}: no need to save it yet.`;
  return { score: 35, mandated: true, reason: reason("save-principle", [id], text) };
}

/**
 * Whether `interpretation` is the truth as the viewer sees it: the focus is the card it says, and
 * every connecting card is where it says (the leftmost candidate, for a prompt).
 */
function isReal(judge: Judge, interpretation: Interpretation, focusCard: Card): boolean {
  const { knowledge, seen } = judge;
  if (!sameCard(interpretation.focusIdentity, focusCard)) return false;
  return interpretation.connections.every((connection) => {
    if (hasPlayed(knowledge.moment, connection.card)) return true;
    const id = connectingCards(knowledge, connection)[0];
    const card = id === undefined ? null : seen(id);
    return card !== null && sameCard(card, connection.card);
  });
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
 * The convention a clue read as `interpretation` is an example of: its prompt(s) or finesse, its kind
 * of save, or a (delayed) play clue.
 */
function mainConvention(interpretation: Interpretation): ConventionId {
  const { conventions } = interpretation;
  if (conventions.includes("multi-prompt")) return "multi-prompt";
  const [connection] = interpretation.connections;
  if (connection !== undefined) return connection.kind;
  if (interpretation.kind === "save") {
    return conventions.find((id) => SAVES.includes(id)) ?? "save-clue";
  }
  return conventions.includes("delayed-play-clue") ? "delayed-play-clue" : "play-clue";
}

/**
 * The interpretations the clue receiver would keep after the clue: they see every card the viewer
 * sees except their own hand. The viewer can't see their own hand either, so those cards count as
 * anything the viewer thinks they could be.
 */
function receiverKeeps(judge: Judge, after: Knowledge, receiver: Seat): Interpretation[] {
  const reading = after.readings.at(-1)!;
  const known = seatKnows(judge, after, receiver);
  return pending(reading).filter((interpretation) =>
    couldBe(known[reading.focus]!, interpretation.focusIdentity),
  );
}

/**
 * What `seat` knows about each card, as far as the viewer can tell: they see every card the viewer
 * sees except their own hand, and the viewer's cards count as anything the viewer thinks they
 * could be.
 */
function seatKnows(judge: Pick<Judge, "view" | "mine">, knowledge: Knowledge, seat: Seat): Note[] {
  const { view, mine } = judge;
  const theirs = new Set(knowledge.moment.hands[seat]);
  const ours = new Set(knowledge.moment.hands[view.seat]);
  const cards = view.cards.map((card) => (theirs.has(card.id) ? { ...card, card: null } : card));
  const common = knowledge.common.map((note, id) =>
    ours.has(id) ? narrowed(note, (card) => couldBe(mine[id]!, card)) : note,
  );
  return privateKnowledge({ config: view.config, cards }, { ...knowledge, common });
}

const nextSeat = (view: PlayerView): Seat => (view.seat + 1) % view.config.numPlayers;

/**
 * The card on the next player's chop that the Save Principle protects, if they have nothing else to
 * do first (see `isBusy`). Null if there is none.
 */
function urgentSave(judge: Omit<Judge, "urgent">): CardId | null {
  const { view, knowledge, facts, mine } = judge;
  const { moment } = knowledge;
  if (!judge.uses("save-principle")) return null;
  const next = nextSeat(view);
  const id = chop(knowledge, next);
  if (id === null) return null;
  const card = judge.seen(id)!;
  const visible = (other: Card) =>
    moment.hands.some((hand, seat) =>
      hand.some((cardId) => {
        if (cardId === id) return false;
        const seen = judge.seen(cardId);
        if (seen !== null) return sameCard(seen, other);
        // The viewer's own cards count only where the viewer knows them.
        const known = identity(mine[cardId]!);
        return seat === view.seat && known !== undefined && sameCard(known, other);
      }),
    );
  const protectedCard =
    !facts.isTrash(card, id) &&
    (card.rank === 5 ||
      facts.isCritical(card) ||
      (card.rank === 2 && !visible(card)) ||
      (isPlayable(moment, card) && !visible(card)));
  return protectedCard && !isBusy(judge, knowledge, next) ? id : null;
}

/**
 * Whether `seat` has something to do other than discard their chop: a clued card the table knows
 * is playable or trash, or a card they know they owe a prompt or finesse.
 */
function isBusy(judge: Omit<Judge, "urgent">, knowledge: Knowledge, seat: Seat): boolean {
  const { moment, common } = knowledge;
  const known = moment.hands[seat]!.some(
    (id) =>
      countsAsClued(knowledge, id) &&
      (common[id]!.every((card) => isPlayable(moment, card)) ||
        common[id]!.every((card) => judge.facts.isTrash(card, id))),
  );
  return known || owesPlay(judge, knowledge, seat);
}

/**
 * Whether the next player, `seat`, will know some clue needs them to play now: every reading of it
 * they can't rule out has them play a connecting card that is playable. A reading that needs the
 * viewer to play is ruled out by the time they move, since the viewer doesn't play it this turn.
 */
function owesPlay(judge: Omit<Judge, "urgent">, knowledge: Knowledge, seat: Seat): boolean {
  const open = knowledge.readings.map((reading) => ({ reading, live: pending(reading) }));
  const involved = ({ live }: (typeof open)[number]) =>
    live.some((interpretation) =>
      interpretation.connections.some((connection) => connection.seat === seat),
    );
  if (!open.some(involved)) return false;
  const known = seatKnows(judge, knowledge, seat);
  return open.some(({ reading, live }) => {
    const kept = live.filter(
      (interpretation) =>
        couldBe(known[reading.focus]!, interpretation.focusIdentity) &&
        !interpretation.connections.some((connection) => connection.seat === judge.view.seat),
    );
    return (
      kept.length > 0 &&
      kept.every((interpretation) =>
        interpretation.connections.some(
          (connection) => connection.seat === seat && isPlayable(knowledge.moment, connection.card),
        ),
      )
    );
  });
}
