// What the table knows about each card once H-Group conventions are applied: clue readings, common
// knowledge and private knowledge. See docs/ARCHITECTURE.md ("Knowledge model") and the specs in
// docs/conventions/.
import {
  type Card,
  type CardId,
  type Clue,
  applyEvent,
  type GameEvent,
  type Moment,
  type PlayerView,
  RANKS,
  type Seat,
} from "@hanabi/engine";
import { applies, type ConventionId, type Level } from "./conventions";
import {
  clueMatches,
  cluePossibilities,
  copies,
  identities,
  possibilities,
  sameCard,
  type Sight,
} from "./possibilities";
import { uniqBy } from "./util";

/** The table at one moment and what every player agreed each card could be by then. */
export interface Table {
  readonly level: Level;
  readonly moment: Moment;
  /** Common knowledge: what every player agrees each card could be, indexed by `CardId`. */
  readonly common: readonly (readonly Card[])[];
  /**
   * Unclued cards every player agrees are finessed: they will blind-play, so they count as clued.
   * See `finessed-cards-count-as-clued`.
   */
  readonly finessed: readonly CardId[];
}

/** A clue as given (or as it would be given): who to whom, and the cards it touched, leftmost first. */
export interface GivenClue {
  readonly giver: Seat;
  readonly target: Seat;
  readonly clue: Clue;
  readonly touched: readonly CardId[];
}

/**
 * A card that has to play before a play clue's focus can, and that the table doesn't already know
 * about: a clued card that could be it (a prompt), or an unclued card that blind-plays (a finesse).
 */
export interface Connection {
  readonly kind: "prompt" | "finesse";
  /** Who holds the connecting card. */
  readonly seat: Seat;
  /** The card that has to play. */
  readonly card: Card;
  /**
   * The cards in `seat`'s hand it could be when the clue was given, leftmost first: the clued cards
   * that could be `card` for a prompt (the leftmost is the one to play), the finesse position for a
   * finesse.
   */
  readonly ids: readonly CardId[];
}

/** One way a clue can be read: what its focus is, and what has to happen for it to be true. */
export interface Interpretation {
  readonly kind: "play" | "save";
  /** What the focus card (`ClueReading.focus`) is under this interpretation. */
  readonly focusIdentity: Card;
  /** The cards that must play first, beyond the clued cards the table already knows. */
  readonly connections: readonly Connection[];
  readonly conventions: readonly ConventionId[];
  /** The turn whose event showed this interpretation is wrong, or null while it is still possible. */
  readonly ruledOutOn: number | null;
}

/** How the table reads a clue. */
export interface ClueReading extends GivenClue {
  /** The card the clue is about. See `clue-focus`. */
  readonly focus: CardId;
  /**
   * Every way the table could read the clue when it was given. Later moves rule some out (see
   * `readGame`); the rest stay pending.
   */
  readonly interpretations: readonly Interpretation[];
  /**
   * The conventions the reading used. When there are no interpretations the clue means nothing at
   * the table's level: it is off-convention and carries only its rules-level information.
   */
  readonly conventions: readonly ConventionId[];
}

/** A clue's reading, with the turn it was given on. */
export interface PastReading extends ClueReading {
  readonly turn: number;
}

/** The table now, plus how every clue so far was read. */
export interface Knowledge extends Table {
  /**
   * One reading per clue in the log, oldest first. Interpretations ruled out since are marked with
   * the turn that ruled them out.
   */
  readonly readings: readonly PastReading[];
  /** The turn the next event happens on: how many events have been read. */
  readonly turn: number;
}

/** A reading's interpretations that have not been ruled out. */
export const pending = (reading: ClueReading) =>
  reading.interpretations.filter((interpretation) => interpretation.ruledOutOn === null);

/**
 * What the focus could be under `reading`'s interpretations that have not been ruled out, each card
 * once: under any of them, or only the play or save ones.
 */
export function focusCards(reading: ClueReading, kind?: Interpretation["kind"]): Card[] {
  const cards = pending(reading)
    .filter((interpretation) => kind === undefined || interpretation.kind === kind)
    .map((interpretation) => interpretation.focusIdentity);
  return uniqBy(cards, sameCard);
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

export const isClued = (moment: Moment, id: CardId) => moment.clues[id]!.touchedBy.length > 0;

/**
 * A seat's finesse position: their leftmost unclued card, with finessed cards counting as clued.
 * Undefined if there is none. See `finesse-position`.
 */
export function finessePosition(
  table: Pick<Table, "moment" | "finessed">,
  seat: Seat,
): CardId | undefined {
  const { moment, finessed } = table;
  return moment.hands[seat]!.find((id) => !isClued(moment, id) && !finessed.includes(id));
}

/** Whether `card` is on its stack already. */
export const hasPlayed = (moment: Moment, card: Card) =>
  (moment.stacks[card.suit] ?? 0) >= card.rank;

/**
 * Replays the view's log, reading every clue at the table's `level` to build common knowledge.
 * Deterministic, and the same from every seat's view: only public information is used.
 */
export function readGame(view: PlayerView, level: Level): Knowledge {
  // Cards can start the game already clued (in test scenarios), with no logged clue to read.
  const opening = { level, moment: view.opening, finessed: [] };
  const start: Knowledge = {
    ...opening,
    common: settle(view, { ...opening, common: startingNotes(view, opening.moment) }),
    readings: [],
    turn: 0,
  };
  return view.log.reduce((knowledge, event) => advance(view, knowledge, event), start);
}

/**
 * Knowledge after `event`, which happens on `knowledge`'s table: a clue is read, then the
 * interpretations the event rules out are marked and common knowledge narrows to what the rest
 * allow. Used by `readGame` for each logged event, and to see what an event being considered would
 * change.
 */
export function advance(view: PlayerView, knowledge: Knowledge, event: GameEvent): Knowledge {
  const { level, moment, finessed, turn } = knowledge;
  const table: Table = { level, moment, finessed, common: knowledge.common };
  let { readings } = knowledge;
  let common: (readonly Card[])[];
  if (event.type === "clue") {
    const { seat: giver, target, clue, touched } = event;
    const reading = readClue(view, table, { giver, target, clue, touched });
    readings = [...readings, { ...reading, turn }];
    common = applyReading(view, table, reading);
  } else {
    common = table.common.with(event.cardId, [event.card]);
  }
  const next = resolve(view, { ...table, moment: applyEvent(moment, event), common }, readings, {
    turn,
    event,
  });
  return { ...next.table, readings: next.readings, turn: turn + 1 };
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
 * The reading is common knowledge: it lists every interpretation the table can't rule out from
 * public information. A player narrows it further with the cards they see (`privateKnowledge`).
 */
export function readClue(view: PlayerView, table: Table, given: GivenClue): ClueReading {
  const { level, moment, common, finessed } = table;
  const { target, clue, touched } = given;
  const facts = tableFacts(view, table);

  const newlyTouched = touched.filter((id) => !isClued(moment, id) && !finessed.includes(id));
  const chopId = chop(moment, target);
  const onChop = chopId !== null && newlyTouched.includes(chopId);
  const focus = newlyTouched.length === 0 ? touched[0]! : onChop ? chopId : newlyTouched[0]!;
  const interpretations: Interpretation[] = [];
  const offConvention = { ...given, focus, interpretations, conventions: [] };
  if (!applies("clue-focus", level) || !applies("play-clue", level)) return offConvention;

  const candidates = common[focus]!.filter((card) => clueMatches(card, clue));
  const could = (card: Card) => candidates.some((other) => sameCard(other, card));
  const add = (
    kind: Interpretation["kind"],
    card: Card,
    conventions: ConventionId[],
    connections: Connection[] = [],
  ) =>
    interpretations.push({ kind, focusIdentity: card, connections, conventions, ruledOutOn: null });

  /** Who could be holding `card` for this clue, as a prompt or a finesse. */
  const connect = (card: Card) => connectionsFor(view, table, given, focus, card, facts);

  let plays = true;
  if (onChop && applies("save-clue", level)) {
    const rankSave =
      clue.kind === "rank" && clue.value === 5 && applies("5-save", level)
        ? "5-save"
        : clue.kind === "rank" && clue.value === 2 && applies("2-save", level)
          ? "2-save"
          : undefined;
    if (rankSave !== undefined) {
      // A 5 or 2 clue on chop is a save, never a play clue.
      plays = false;
      for (const card of candidates) {
        if (!facts.isTrash(card, focus)) add("save", card, ["save-clue", rankSave]);
      }
    } else if (applies("critical-save", level)) {
      // A 5 is only saved with a 5 clue; any other clue on it is a play clue.
      for (const card of candidates) {
        if (card.rank !== 5 && facts.isCritical(card)) {
          add("save", card, ["save-clue", "critical-save"]);
        }
      }
    }
  }
  for (const suit of plays ? view.config.suits : []) {
    const next = facts.next(suit);
    if (next === undefined) continue;
    const now = next.rank === (moment.stacks[suit] ?? 0) + 1;
    if (could(next) && now) add("play", next, ["play-clue"]);
    if (could(next) && !now && applies("delayed-play-clue", level)) {
      add("play", next, ["play-clue", "delayed-play-clue"]);
    }
    // One card further on, if a prompt or a finesse can supply the card in between.
    const beyond = RANKS.find((rank) => rank === next.rank + 1);
    if (beyond === undefined) continue;
    const card = { suit, rank: beyond };
    if (!could(card) || facts.isTrash(card, focus)) continue;
    for (const { connection, conventions } of connect(next)) {
      add("play", card, ["play-clue", ...conventions], [connection]);
    }
  }

  if (interpretations.length === 0) return offConvention;
  const conventions: ConventionId[] = ["clue-focus"];
  for (const id of interpretations.flatMap((interpretation) => interpretation.conventions)) {
    if (!conventions.includes(id)) conventions.push(id);
  }
  const othersTouched = newlyTouched.some((id) => id !== focus);
  if (othersTouched && applies("good-touch", level)) conventions.push("good-touch");
  return { ...given, focus, interpretations, conventions };
}

/**
 * The ways `card` could be supplied so that a play clue on the card after it makes sense, in turn
 * order from the clue giver. Level 1 allows one such card per clue:
 *
 * - A prompt: any seat but the giver's (the receiver's included) has clued cards that could be
 *   `card`. If those cards were going to play anyway it is a delayed play clue, not a prompt.
 * - A finesse: a seat that plays after the giver and before the receiver has no such clued card
 *   (`prompts-before-finesses`), and `card` is playable now, so their finesse position blind-plays.
 */
function connectionsFor(
  view: PlayerView,
  table: Table,
  given: GivenClue,
  focus: CardId,
  card: Card,
  facts: TableFacts,
): { connection: Connection; conventions: ConventionId[] }[] {
  const { level, moment, common } = table;
  const { giver, target } = given;
  const players = view.config.numPlayers;
  const receiverStep = (target - giver + players) % players;
  const result: { connection: Connection; conventions: ConventionId[] }[] = [];

  for (let step = 1; step < players; step++) {
    const seat = (giver + step) % players;
    const beforeReceiver = step < receiverStep;
    const ids = moment.hands[seat]!.filter(
      (id) =>
        id !== focus && isClued(moment, id) && common[id]!.some((other) => sameCard(other, card)),
    );
    if (ids.length > 0) {
      const anyway = ids.every((id) => common[id]!.every((other) => facts.isNext(other)));
      const kind = anyway ? "delayed-play-clue" : "prompt";
      if (!applies(kind, level)) continue;
      const conventions: ConventionId[] = [kind];
      if (!anyway && beforeReceiver && applies("prompts-before-finesses", level)) {
        conventions.push("prompts-before-finesses");
      }
      result.push({ connection: { kind: "prompt", seat, card, ids }, conventions });
    } else if (
      beforeReceiver &&
      applies("finesse", level) &&
      card.rank === (moment.stacks[card.suit] ?? 0) + 1
    ) {
      const id = finessePosition(table, seat);
      if (id === undefined) continue;
      result.push({
        connection: { kind: "finesse", seat, card, ids: [id] },
        conventions: ["finesse", "finesse-position"],
      });
    }
  }
  return result;
}

/** Common knowledge after `reading`'s clue, on the table it was given on. */
function applyReading(view: PlayerView, table: Table, reading: ClueReading): (readonly Card[])[] {
  const { moment, level } = table;
  const common = [...table.common];
  const facts = tableFacts(view, table);
  const meant = focusCards(reading);
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
 * Brings knowledge up to date after an event: settles common knowledge, rules out the
 * interpretations the table now contradicts, narrows each pending clue to what its remaining
 * interpretations allow, and works out which cards are finessed. Repeats until nothing changes.
 */
function resolve(
  view: PlayerView,
  table: Table,
  readings: readonly PastReading[],
  last: { turn: number; event: GameEvent },
): { table: Table; readings: readonly PastReading[] } {
  for (;;) {
    const settled = { ...table, common: settle(view, table) };
    const ruled = ruleOut(settled, readings, last);
    const next = { ...settled, ...narrow(settled, ruled) };
    const same =
      ruled === readings &&
      next.finessed.length === table.finessed.length &&
      next.common.every((note, id) => note.length === table.common[id]!.length);
    if (same) return { table: next, readings };
    [table, readings] = [next, ruled];
  }
}

/**
 * Marks the interpretations `last` (the latest event) leaves impossible: the focus can no longer be
 * the card the interpretation says, a connecting card can no longer be anywhere it was promised, or
 * a finessed player took their turn without blind-playing the card (finesses are urgent). Returns
 * `readings` itself if nothing changed.
 */
function ruleOut(
  table: Table,
  readings: readonly PastReading[],
  last: { turn: number; event: GameEvent },
): readonly PastReading[] {
  const possible = (reading: PastReading, interpretation: Interpretation) =>
    interpretation.ruledOutOn !== null ||
    (table.common[reading.focus]!.some((card) => sameCard(card, interpretation.focusIdentity)) &&
      interpretation.connections.every((connection) => {
        if (hasPlayed(table.moment, connection.card)) return true;
        const acted = last.turn > reading.turn && last.event.seat === connection.seat;
        if (connection.kind === "finesse" && acted) return false;
        return connectingCards(table, connection).length > 0;
      }));
  const result = readings.map((reading) => {
    if (reading.interpretations.every((interpretation) => possible(reading, interpretation))) {
      return reading;
    }
    const interpretations = reading.interpretations.map((interpretation) =>
      possible(reading, interpretation)
        ? interpretation
        : { ...interpretation, ruledOutOn: last.turn },
    );
    return { ...reading, interpretations };
  });
  return result.every((reading, i) => reading === readings[i]) ? readings : result;
}

/** The cards in `connection`'s hand that could still be its card, leftmost first. */
export function connectingCards(
  table: Pick<Table, "moment" | "common">,
  connection: Connection,
): CardId[] {
  const hand = table.moment.hands[connection.seat]!;
  return connection.ids.filter(
    (id) => hand.includes(id) && table.common[id]!.some((card) => sameCard(card, connection.card)),
  );
}

/**
 * Common knowledge narrowed to what each clue's remaining interpretations allow, and the cards they
 * all agree are finessed.
 */
function narrow(
  table: Table,
  readings: readonly PastReading[],
): { common: (readonly Card[])[]; finessed: CardId[] } {
  const common = [...table.common];
  const finessed: CardId[] = [];
  for (const reading of readings) {
    const live = pending(reading);
    if (live.length === 0) continue;
    narrowNote(
      common,
      reading.focus,
      live.map((interpretation) => interpretation.focusIdentity),
    );
    for (const [id, cards] of pinned(table, live, () => true)) narrowNote(common, id, cards);
    finessed.push(...finessedBy(table, live));
  }
  return { common, finessed };
}

/** Narrows `notes[id]` to `cards`, unless that would leave nothing. */
function narrowNote(notes: (readonly Card[])[], id: CardId, cards: readonly Card[]) {
  const note = notes[id]!.filter((card) => cards.some((other) => sameCard(other, card)));
  if (note.length > 0) notes[id] = note;
}

/**
 * The connecting cards that every one of `live` pins down, with what each interpretation says they
 * are. A connection pins a card when exactly one card could still be it; `could` says which cards
 * can.
 */
function pinned(
  table: Table,
  live: readonly Interpretation[],
  could: (id: CardId, card: Card) => boolean,
): Map<CardId, Card[]> {
  const pins = live.map((interpretation) => {
    const pinsHere = new Map<CardId, Card>();
    for (const connection of interpretation.connections) {
      if (hasPlayed(table.moment, connection.card)) continue;
      const ids = connectingCards(table, connection).filter((id) => could(id, connection.card));
      if (ids.length === 1) pinsHere.set(ids[0]!, connection.card);
    }
    return pinsHere;
  });
  const result = new Map<CardId, Card[]>();
  for (const id of pins[0]!.keys()) {
    if (pins.every((pin) => pin.has(id)))
      result.set(
        id,
        pins.map((pin) => pin.get(id)!),
      );
  }
  return result;
}

/** The cards that every one of `live` finesses, while they are still waiting to blind-play. */
function finessedBy(table: Table, live: readonly Interpretation[]): CardId[] {
  const inHand = new Set(table.moment.hands.flat());
  const finesses = live.map((interpretation) =>
    interpretation.connections
      .filter(({ kind, card }) => kind === "finesse" && !hasPlayed(table.moment, card))
      .map(({ ids }) => ids[0]!),
  );
  return finesses[0]!.filter((id) => inHand.has(id) && finesses.every((ids) => ids.includes(id)));
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
  // Discarded cards are public. (Played cards are filled in from their play events. A card in the
  // draw pile then may be visible to the viewer now, but it was hidden from the table.)
  for (const id of moment.discardPile) common[id] = [view.cards[id]!.card!];

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
 * cards the viewer can see. The viewer is a `Sight`, so a seat can also work out what a teammate
 * would know. Visible cards are known exactly. Under Good Touch the viewer's clued
 * cards are also not any clued card they can see in another hand. Each pending clue keeps only the
 * interpretations that fit what the viewer knows, which can pin down the focus or a connecting card:
 * a player who sees the focus of a clue knows whether they were prompted or finessed.
 */
export function privateKnowledge(view: Sight, knowledge: Knowledge): (readonly Card[])[] {
  const { moment, common, level, readings } = knowledge;
  const visibleClued = moment.hands
    .flat()
    .filter((id) => isClued(moment, id))
    .flatMap((id) => view.cards[id]!.card ?? []);
  let known = possibilities(view, (id) => {
    const note = common[id]!;
    if (!isClued(moment, id) || !applies("good-touch", level)) return note;
    const narrowed = note.filter((card) => !visibleClued.some((seen) => sameCard(seen, card)));
    return narrowed.length > 0 ? narrowed : note;
  });

  // If the table misread a clue, what the viewer sees can rule out every card the table allows.
  // Such a card falls back to what the rules allow.
  const rules = possibilities(view);
  const fallBack = (notes: (readonly Card[])[]) =>
    notes.map((note, id) => (note.length > 0 ? note : rules[id]!));
  known = fallBack(known);
  const could = (id: CardId, card: Card) => known[id]!.some((other) => sameCard(other, card));
  for (;;) {
    const notes = [...known];
    for (const reading of readings) {
      const live = pending(reading).filter(
        (interpretation) =>
          could(reading.focus, interpretation.focusIdentity) &&
          interpretation.connections.every(
            (connection) =>
              hasPlayed(moment, connection.card) ||
              connectingCards(knowledge, connection).some((id) => could(id, connection.card)),
          ),
      );
      if (live.length === 0) continue;
      narrowNote(
        notes,
        reading.focus,
        live.map((interpretation) => interpretation.focusIdentity),
      );
      for (const [id, cards] of pinned(knowledge, live, could)) narrowNote(notes, id, cards);
    }
    const next = fallBack(possibilities(view, (id) => notes[id]!));
    if (next.every((note, id) => note.length === known[id]!.length)) return next;
    known = next;
  }
}

export type TableFacts = ReturnType<typeof tableFacts>;

/** Facts about the table that every player agrees on. */
export function tableFacts(view: PlayerView, table: Table) {
  const { moment, common, finessed } = table;
  const { config } = view;

  /** Clued (or finessed) cards whose identity the whole table knows. */
  const gotten = moment.hands
    .flat()
    .filter((id) => isClued(moment, id) || finessed.includes(id))
    .flatMap((id) => (common[id]!.length === 1 ? [{ id, card: common[id]![0]! }] : []));
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

  /**
   * The card `suit` needs next once every gotten card has played: what a play clue in that suit can
   * be on without a prompt or finesse. Undefined if the suit can't go further.
   */
  const next = (suit: string): Card | undefined => {
    for (const rank of RANKS) {
      const card = { suit, rank };
      if (rank <= stack(card) || gotten.some((got) => sameCard(got.card, card))) continue;
      return reachable(card) ? card : undefined;
    }
    return undefined;
  };

  return {
    next,
    /** Whether `card` is the next card its suit needs. */
    isNext: (card: Card) => {
      const needed = next(card.suit);
      return needed !== undefined && sameCard(needed, card);
    },
    /** Trash: can never play, or another gotten card (not `self`) is already this card. */
    isTrash: (card: Card, self: CardId) =>
      !reachable(card) ||
      gotten.some(({ id, card: other }) => id !== self && sameCard(other, card)),
    /** Critical: still needed, and every other copy has been discarded. */
    isCritical: (card: Card) => reachable(card) && discarded(card) === copies(config, card) - 1,
  };
}
