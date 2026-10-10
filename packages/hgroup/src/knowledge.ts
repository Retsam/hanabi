// What the table knows about each card once H-Group conventions are applied: clue readings, common
// knowledge and private knowledge. See docs/ARCHITECTURE.md ("Knowledge model") and the specs in
// docs/conventions/.
import {
  type Card,
  type CardId,
  type Clue,
  type PlayerView,
  RANKS,
  type Seat,
} from "@hanabi/engine";
import { applies, type ConventionId, type Level } from "./conventions";
import { history, type Moment } from "./history";
import {
  clueMatches,
  cluePossibilities,
  copies,
  identities,
  possibilities,
  sameCard,
} from "./possibilities";

/** The table at one moment and what every player agreed each card could be by then. */
export interface Table {
  readonly level: Level;
  readonly moment: Moment;
  /** Common knowledge: what every player agrees each card could be, indexed by `CardId`. */
  readonly common: readonly (readonly Card[])[];
}

/** A clue as given (or as it would be given): who to whom, and the cards it touched, leftmost first. */
export interface GivenClue {
  readonly giver: Seat;
  readonly target: Seat;
  readonly clue: Clue;
  readonly touched: readonly CardId[];
}

/** How the table reads a clue. */
export interface ClueReading extends GivenClue {
  /** The card the clue is about. See `clue-focus`. */
  readonly focus: CardId;
  /** What the focus could be if this is a play clue (immediate or delayed). Empty if it can't be. */
  readonly play: readonly Card[];
  /** What the focus could be if this is a save clue. Empty if it can't be. */
  readonly save: readonly Card[];
  /**
   * The conventions the reading used. When `play` and `save` are both empty the clue means nothing
   * at the table's level: it is off-convention and carries only its rules-level information.
   */
  readonly conventions: readonly ConventionId[];
}

/** The table now, plus how every clue so far was read. */
export interface Knowledge extends Table {
  /** One reading per clue in the log, oldest first, with the turn it was given on. */
  readonly readings: readonly (ClueReading & { readonly turn: number })[];
}

/**
 * A seat's chop: their oldest unclued card, which they discard next if they have nothing better to
 * do. Null if every card in their hand is clued.
 */
export function chop(moment: Moment, seat: Seat): CardId | null {
  const hand = moment.hands[seat]!;
  return hand.findLast((id) => !isClued(moment, id)) ?? null;
}

const key = (card: Card) => `${card.suit} ${card.rank}`;

const isClued = (moment: Moment, id: CardId) => moment.clues[id]!.touchedBy.length > 0;

/**
 * Replays the view's log, reading every clue at the table's `level` to build common knowledge.
 * Deterministic, and judged only from what the viewer can see (see `readClue` for the one
 * approximation that involves the viewer's own hand).
 */
export function readGame(view: PlayerView, level: Level): Knowledge {
  const moments = history(view);
  // Cards can start the game already clued (in test scenarios), with no logged clue to read.
  const start = { level, moment: moments[0]!, common: startingNotes(view, moments[0]!) };
  let common = settle(view, start);
  const readings: (ClueReading & { turn: number })[] = [];

  for (const [turn, event] of view.log.entries()) {
    const moment = moments[turn]!;
    if (event.type === "clue") {
      const table = { level, moment, common };
      const { seat: giver, target, clue, touched } = event;
      const reading = readClue(view, table, { giver, target, clue, touched });
      readings.push({ ...reading, turn });
      common = applyReading(view, table, reading);
    } else {
      common = common.with(event.cardId, [event.card]);
    }
    common = settle(view, { level, moment: moments[turn + 1]!, common });
  }
  return { level, moment: moments.at(-1)!, common, readings };
}

/** Each card's clue possibilities at `moment`, shared between cards with no clues. */
function startingNotes(view: PlayerView, moment: Moment): (readonly Card[])[] {
  const all = identities(view.config);
  return moment.clues.map((clues) =>
    clues.touchedBy.length + clues.notTouchedBy.length === 0
      ? all
      : cluePossibilities(view.config, clues),
  );
}

/**
 * Reads a clue on `table`, the moment before it is given. Used both for clues in the log and to
 * predict how a clue the viewer is considering would be read.
 *
 * The receiver reads the clue using every clued card they can identify: cards in other hands by
 * sight, and cards in their own hand by common knowledge. The viewer can't see their own hand, so
 * when the viewer is not the receiver, a play clue may also be delayed through any card the
 * viewer's unidentified clued cards could be: the reading is then a superset of the receiver's.
 */
export function readClue(view: PlayerView, table: Table, given: GivenClue): ClueReading {
  const { level, moment, common } = table;
  const { target, clue, touched } = given;
  const facts = tableFacts(view, table, target);

  const newlyTouched = touched.filter((id) => !isClued(moment, id));
  const chopId = chop(moment, target);
  const onChop = chopId !== null && newlyTouched.includes(chopId);
  const focus = newlyTouched.length === 0 ? touched[0]! : onChop ? chopId : newlyTouched[0]!;
  const reading = { ...given, focus, play: [] as Card[], save: [] as Card[] };
  if (!applies("clue-focus", level) || !applies("play-clue", level)) {
    return { ...reading, conventions: [] };
  }

  const candidates = common[focus]!.filter((card) => clueMatches(card, clue));
  const playable = candidates.filter((card) => facts.playable.some((next) => sameCard(next, card)));
  const conventions: ConventionId[] = ["clue-focus"];
  let play: Card[] = playable;
  let save: Card[] = [];

  if (onChop && applies("save-clue", level)) {
    if (clue.kind === "rank" && clue.value === 5 && applies("5-save", level)) {
      [play, save] = [[], candidates.filter((card) => !facts.isTrash(card, focus))];
      conventions.push("save-clue", "5-save");
    } else if (clue.kind === "rank" && clue.value === 2 && applies("2-save", level)) {
      [play, save] = [[], candidates.filter((card) => !facts.isTrash(card, focus))];
      conventions.push("save-clue", "2-save");
    } else if (applies("critical-save", level)) {
      // A 5 is only saved with a 5 clue; any other clue on it is a play clue.
      save = candidates.filter((card) => card.rank !== 5 && facts.isCritical(card));
      if (save.length > 0) conventions.push("save-clue", "critical-save");
    }
  }
  const playableNow = (card: Card) => card.rank === (moment.stacks[card.suit] ?? 0) + 1;
  if (!applies("delayed-play-clue", level)) play = play.filter(playableNow);
  if (play.length > 0) conventions.push("play-clue");
  if (!play.every(playableNow)) conventions.push("delayed-play-clue");
  const othersTouched = newlyTouched.some((id) => id !== focus);
  if (othersTouched && applies("good-touch", level) && (play.length > 0 || save.length > 0)) {
    conventions.push("good-touch");
  }
  const meansSomething = play.length > 0 || save.length > 0;
  return { ...reading, play, save, conventions: meansSomething ? conventions : [] };
}

/** Common knowledge after `reading`'s clue, on the table it was given on. */
function applyReading(view: PlayerView, table: Table, reading: ClueReading): (readonly Card[])[] {
  const { moment, level } = table;
  const common = [...table.common];
  const facts = tableFacts(view, table, reading.target);
  const meant = [...reading.play, ...reading.save];
  const focusIs = meant.length === 1 ? meant[0] : undefined;

  for (const id of moment.hands[reading.target]!) {
    const before = common[id]!;
    const isTouched = reading.touched.includes(id);
    const fits = (card: Card) => clueMatches(card, reading.clue) === isTouched;
    // If an earlier misread ruled out what the clue now says, fall back to the rules.
    const rules = () => cluePossibilities(view.config, moment.clues[id]!).filter(fits);
    const touched = before.some(fits) ? before.filter(fits) : rules();
    if (!isTouched) {
      common[id] = touched;
      continue;
    }
    let note = touched;
    if (id === reading.focus && meant.length > 0) {
      note = touched.filter((card) => meant.some((m) => sameCard(m, card)));
    } else if (!isClued(moment, id) && meant.length > 0 && applies("good-touch", level)) {
      // Good Touch: a newly touched card will play one day, so it is not trash, and it is not the
      // same card as any other clued card, the focus included.
      note = touched.filter(
        (card) => !facts.isTrash(card, id) && !(focusIs !== undefined && sameCard(card, focusIs)),
      );
    }
    common[id] = note.length > 0 ? note : touched;
  }
  return common;
}

/**
 * Narrows common knowledge with what follows from it, repeating until nothing changes: an identity
 * is ruled out once every copy is accounted for in public (played, discarded or known to be another
 * card in a hand), and under Good Touch no two clued cards are the same identity. A note is never
 * narrowed to nothing, so a misread clue leaves it as it was.
 */
function settle(view: PlayerView, table: Table): (readonly Card[])[] {
  const { moment, level, config } = { ...table, config: view.config };
  const common = [...table.common];
  const inHand = new Set(moment.hands.flat());
  // Cards out of every hand are public once anyone can see them (the draw pile is hidden).
  for (const { id, card } of view.cards) if (!inHand.has(id) && card !== null) common[id] = [card];

  const known = (id: CardId) => (common[id]!.length === 1 ? common[id]![0] : undefined);
  let changed = true;
  while (changed) {
    changed = false;
    const accounted = new Map<string, number>();
    const count = (card: Card) => accounted.set(key(card), (accounted.get(key(card)) ?? 0) + 1);
    for (const id of moment.discardPile) count(view.cards[id]!.card!);
    for (const suit of config.suits) {
      for (const rank of RANKS) if (rank <= (moment.stacks[suit] ?? 0)) count({ suit, rank });
    }
    for (const id of inHand) {
      const card = known(id);
      if (card) count(card);
    }
    const cluedKnown = [...inHand].filter((id) => isClued(moment, id) && known(id));

    for (const id of inHand) {
      const own = known(id);
      const note = common[id]!.filter((card) => {
        const elsewhere = (accounted.get(key(card)) ?? 0) - (own && sameCard(own, card) ? 1 : 0);
        if (elsewhere >= copies(config, card)) return false;
        if (!isClued(moment, id) || !applies("good-touch", level)) return true;
        // Good Touch: a clued card will play one day, so it is no card that has already played.
        if (card.rank <= (moment.stacks[card.suit] ?? 0)) return false;
        return !cluedKnown.some((other) => other !== id && sameCard(known(other)!, card));
      });
      if (note.length > 0 && note.length < common[id]!.length) {
        common[id] = note;
        changed = true;
      }
    }
  }
  return common;
}

/**
 * What the viewer knows about each card, indexed by `CardId`: common knowledge, narrowed by the
 * cards the viewer can see. Visible cards are known exactly. Under Good Touch the viewer's clued
 * cards are also not any clued card they can see in another hand.
 */
export function privateKnowledge(view: PlayerView, knowledge: Knowledge): (readonly Card[])[] {
  const { moment, common, level } = knowledge;
  const visibleClued = moment.hands
    .flatMap((hand, seat) => (seat === view.seat ? [] : hand))
    .filter((id) => isClued(moment, id))
    .map((id) => view.cards[id]!.card!);
  return possibilities(view, (id) => {
    const note = common[id]!;
    if (!isClued(moment, id) || !applies("good-touch", level)) return note;
    const narrowed = note.filter((card) => !visibleClued.some((seen) => sameCard(seen, card)));
    return narrowed.length > 0 ? narrowed : note;
  });
}

/** Facts about the table as `receiver` would see them. */
function tableFacts(view: PlayerView, table: Table, receiver: Seat) {
  const { moment, common } = table;
  const { config } = view;
  const ownHand = moment.hands[receiver]!;

  /** A card's identity as the receiver knows it, if they do. */
  const knownToReceiver = (id: CardId): Card | undefined => {
    const seen = ownHand.includes(id) ? null : view.cards[id]!.card;
    if (seen) return seen;
    const note = common[id]!;
    return note.length === 1 ? note[0] : undefined;
  };
  /** Clued cards in any hand that the receiver can identify. */
  const gotten = moment.hands
    .flat()
    .filter((id) => isClued(moment, id))
    .flatMap((id) => {
      const card = knownToReceiver(id);
      return card ? [{ id, card }] : [];
    });
  // The receiver can see the viewer's clued cards, but the viewer can't. Any identity the table
  // allows for one of them might be a clued card the receiver is counting on.
  const unidentified =
    receiver === view.seat
      ? []
      : moment.hands[view.seat]!.filter((id) => isClued(moment, id) && common[id]!.length > 1);
  const maybeGotten = (card: Card) =>
    unidentified.some((id) => common[id]!.some((other) => sameCard(other, card)));
  const discarded = (card: Card) =>
    moment.discardPile.filter((id) => sameCard(view.cards[id]!.card!, card)).length;
  const stack = (card: Card) => moment.stacks[card.suit] ?? 0;

  /** Whether `card` can still be played: it isn't on its stack and no card below it is lost. */
  const reachable = (card: Card) => {
    if (card.rank <= stack(card)) return false;
    return RANKS.filter((rank) => rank > stack(card) && rank < card.rank).every((rank) => {
      const below = { suit: card.suit, rank };
      return discarded(below) < copies(config, below);
    });
  };

  return {
    /**
     * The card each suit needs next once every clued card the receiver can identify has played:
     * what a play clue can be on, now or delayed. A suit can offer more than one card when the
     * chain runs through one of the viewer's clued cards that only the receiver can see.
     */
    playable: config.suits.flatMap((suit) => {
      const next: Card[] = [];
      for (const rank of RANKS) {
        const card = { suit, rank };
        if (rank <= stack(card) || gotten.some((got) => sameCard(got.card, card))) continue;
        if (!reachable(card)) break;
        next.push(card);
        if (!maybeGotten(card)) break;
      }
      return next;
    }),
    /** Trash: can never play, or another clued card (not `self`) is already this card. */
    isTrash: (card: Card, self: CardId) =>
      !reachable(card) ||
      gotten.some(({ id, card: other }) => id !== self && sameCard(other, card)),
    /** Critical: still needed, and every other copy has been discarded. */
    isCritical: (card: Card) => reachable(card) && discarded(card) === copies(config, card) - 1,
  };
}
