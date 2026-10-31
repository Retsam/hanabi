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
import { applies, type ConventionId, type Level } from "./conventions.ts";
import {
  clueMatches,
  cluePossibilities,
  copies,
  identities,
  possibilities,
  sameCard,
  type Sight,
} from "./possibilities.ts";
import { couldBe, identity, narrowed, type Note, sameSizes } from "./notes.ts";
import { assert, fixpoint, seatsAfter, uniqBy } from "./util.ts";

/** The table at one moment and what every player agreed each card could be by then. */
export interface Table {
  readonly level: Level;
  readonly moment: Moment;
  /** Common knowledge: what every player agrees each card could be, indexed by `CardId`. */
  readonly common: readonly Note[];
  /**
   * Unclued cards every player agrees are finessed: they will blind-play, so they count as clued.
   * See `finessed-cards-count-as-clued`.
   */
  readonly finessed: readonly CardId[];
  /** Whether nobody has discarded yet: the Early Game (`early-game`). */
  readonly earlyGame: boolean;
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
  /**
   * The cards in the giver's hand that counted as clued when the clue was given. The giver couldn't
   * see them, so a save may copy one (`mayCopy`).
   */
  readonly giverClued: readonly CardId[];
  /**
   * The cards the giver saw off their holder's chop, in hands other than the target's, when the clue
   * was given. By the Visible Rule a 2 Save is never on a copy of one (`twoSaveSeen`).
   */
  readonly giverSawOffChop: readonly CardId[];
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
 * Whether Good Touch can't rule out two clued cards being the same card. The Save Principle comes
 * first, so a clue that may be a save can touch a copy of a clued card its giver couldn't see: one
 * in their own hand. See `save-principle`.
 */
export function mayCopy(readings: readonly ClueReading[]) {
  const saves = readings.filter((reading) => focusCards(reading, "save").length > 0);
  const saved = (focus: CardId, other: CardId) =>
    saves.some((reading) => reading.focus === focus && reading.giverClued.includes(other));
  return (a: CardId, b: CardId) => saved(a, b) || saved(b, a);
}

/**
 * A seat's chop: their oldest unclued card, which they discard next if they have nothing better to
 * do. Finessed cards count as clued. Null if every card in their hand is clued.
 */
export function chop(table: Pick<Table, "moment" | "finessed">, seat: Seat): CardId | null {
  const hand = table.moment.hands[seat]!;
  return hand.findLast((id) => !countsAsClued(table, id)) ?? null;
}

const key = (card: Card) => `${card.suit} ${card.rank}`;

export const isClued = (moment: Moment, id: CardId) => moment.clues[id]!.touchedBy.length > 0;

/**
 * Whether a card is clued or finessed: a finessed card will blind-play, so it counts as clued. See
 * `finessed-cards-count-as-clued`.
 */
export const countsAsClued = (table: Pick<Table, "moment" | "finessed">, id: CardId) =>
  isClued(table.moment, id) || table.finessed.includes(id);

/**
 * A seat's finesse position: their leftmost unclued card, with finessed cards counting as clued.
 * Undefined if there is none. See `finesse-position`.
 */
export function finessePosition(
  table: Pick<Table, "moment" | "finessed">,
  seat: Seat,
): CardId | undefined {
  return table.moment.hands[seat]!.find((id) => !countsAsClued(table, id));
}

/** How many cards of `suit` have been played. Every suit in the config has a stack. */
export function stackHeight(moment: Moment, suit: string): number {
  const height = moment.stacks[suit];
  assert(height !== undefined, `No stack for suit ${suit}`);
  return height;
}

/** Whether `card` is on its stack already. */
export const hasPlayed = (moment: Moment, card: Card) =>
  stackHeight(moment, card.suit) >= card.rank;

/** Whether `card` is the next card its stack needs. */
export const isPlayable = (moment: Moment, card: Card) =>
  card.rank === stackHeight(moment, card.suit) + 1;

/**
 * Replays the view's log, reading every clue at the table's `level` to build common knowledge.
 * Deterministic, and the same from every seat's view: only public information is used.
 */
export function readGame(view: PlayerView, level: Level): Knowledge {
  // Cards can start the game already clued (in test scenarios), with no logged clue to read.
  // A test scenario can start with cards already discarded: past the Early Game.
  const earlyGame = view.opening.discardPile.length === 0;
  const opening = { level, moment: view.opening, finessed: [], earlyGame };
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
  const { level, moment, finessed, earlyGame, turn } = knowledge;
  const table: Table = { level, moment, finessed, earlyGame, common: knowledge.common };
  let { readings } = knowledge;
  let common: Note[];
  if (event.type === "clue") {
    const { seat: giver, target, clue, touched } = event;
    const reading = readClue(view, table, { giver, target, clue, touched });
    readings = [...readings, { ...reading, turn }];
    common = applyReading(view, table, reading);
  } else {
    common = table.common.with(event.cardId, [event.card]);
  }
  const after = {
    ...table,
    moment: applyEvent(moment, event),
    common,
    earlyGame: earlyGame && event.type !== "discard",
  };
  const next = resolve(view, after, readings, { turn, event });
  return { ...next.table, readings: next.readings, turn: turn + 1 };
}

/** Each card's clue possibilities at `moment`, shared between cards with no clues. */
function startingNotes(view: PlayerView, moment: Moment): Note[] {
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
  const uses = (convention: ConventionId) => applies(convention, table.level);
  const focus = clueFocus(table, given);
  const giverClued = table.moment.hands[given.giver]!.filter((id) => countsAsClued(table, id));
  const giverSawOffChop = table.moment.hands.flatMap((hand, seat) =>
    seat === given.giver || seat === given.target
      ? []
      : hand.filter((id) => id !== chop(table, seat)),
  );
  const offConvention = {
    ...given,
    giverClued,
    giverSawOffChop,
    focus,
    interpretations: [],
    conventions: [],
  };
  if (!uses("clue-focus") || !uses("play-clue")) return offConvention;

  const read: ClueOnTable = {
    view,
    table,
    given,
    focus,
    facts: tableFacts(view, table, { ...given, focus }),
    candidates: table.common[focus]!.filter((card) => clueMatches(card, given.clue)),
    uses,
  };
  const onChop = focus === chop(table, given.target);
  const saves = onChop && uses("save-clue");
  const rankSave = saves ? rankSaveFor(read) : undefined;
  const interpretations = isFiveStall(read, onChop)
    ? stallReadings(read)
    : [
        ...(saves ? saveReadings(read, rankSave) : []),
        // A 5 or 2 clue on chop is a save, never a play clue.
        ...(rankSave === undefined ? playReadings(read) : []),
      ];
  if (interpretations.length === 0) return offConvention;

  const conventions = uniqBy<ConventionId>([
    "clue-focus",
    ...interpretations.flatMap((interpretation) => interpretation.conventions),
  ]);
  const othersTouched = given.touched.some((id) => id !== focus && !countsAsClued(table, id));
  if (othersTouched && uses("good-touch")) conventions.push("good-touch");
  return { ...given, giverClued, giverSawOffChop, focus, interpretations, conventions };
}

/** A clue being read: the table it is given on, its focus, and what the focus could be. */
interface ClueOnTable {
  readonly view: PlayerView;
  readonly table: Table;
  readonly given: GivenClue;
  readonly focus: CardId;
  readonly facts: TableFacts;
  /** What the table thought the focus could be, narrowed to what the clue touches. */
  readonly candidates: Note;
  /** Whether a convention is in force at the table's level. */
  readonly uses: (convention: ConventionId) => boolean;
}

const readAs = (
  kind: Interpretation["kind"],
  focusIdentity: Card,
  conventions: ConventionId[],
  connections: Connection[] = [],
): Interpretation => ({ kind, focusIdentity, connections, conventions, ruledOutOn: null });

/**
 * The card a clue is about (`clue-focus`): the chop if the clue newly touched it, else the leftmost
 * newly touched card, else (a clue that touches nothing new) the leftmost card it touches.
 */
function clueFocus(table: Table, { target, touched }: GivenClue): CardId {
  const newlyTouched = touched.filter((id) => !countsAsClued(table, id));
  const chopId = chop(table, target);
  if (chopId !== null && newlyTouched.includes(chopId)) return chopId;
  return newlyTouched[0] ?? touched[0]!;
}

/** The save a rank clue on chop always is: a 5 Save or a 2 Save. */
function rankSaveFor({ given: { clue }, uses }: ClueOnTable): "5-save" | "2-save" | undefined {
  if (clue.kind !== "rank") return undefined;
  if (clue.value === 5 && uses("5-save")) return "5-save";
  if (clue.value === 2 && uses("2-save")) return "2-save";
  return undefined;
}

/**
 * The saves a clue on chop can be: a 5 or 2 Save on any of those that isn't trash, or a Critical
 * Save on a critical card.
 */
function saveReadings(read: ClueOnTable, rankSave: "5-save" | "2-save" | undefined) {
  const { candidates, facts, focus } = read;
  if (rankSave !== undefined) {
    return candidates
      .filter((card) => !facts.isTrash(card, focus))
      .map((card) => readAs("save", card, ["save-clue", rankSave]));
  }
  if (!read.uses("critical-save")) return [];
  // A 5 is only saved with a 5 clue; any other clue on it is a play clue.
  return candidates
    .filter((card) => card.rank !== 5 && facts.isCritical(card))
    .map((card) => readAs("save", card, ["save-clue", "critical-save"]));
}

/** Whether a clue is a 5 Stall: a number 5 clue off chop in the Early Game (`5-stall`). */
function isFiveStall({ given: { clue }, table, uses }: ClueOnTable, onChop: boolean): boolean {
  return clue.kind === "rank" && clue.value === 5 && !onChop && table.earlyGame && uses("5-stall");
}

/**
 * The 5 Stall saves its focus like a 5 Save off chop: it is any 5 that isn't trash, and nothing has
 * to play.
 */
function stallReadings({ candidates, facts, focus }: ClueOnTable): Interpretation[] {
  return candidates
    .filter((card) => !facts.isTrash(card, focus))
    .map((card) => readAs("save", card, ["save-clue", "5-stall"]));
}

/** The play clues a clue can be, suit by suit: on the card its suit needs next, or one beyond. */
function playReadings(read: ClueOnTable): Interpretation[] {
  return read.view.config.suits.flatMap((suit) => {
    const next = read.facts.next(suit);
    if (next === undefined) return [];
    return [...directPlay(read, next), ...connectedPlay(read, next)];
  });
}

/** A play clue on `next`, the card its suit needs: playable now, or once the clued cards before it play. */
function directPlay(read: ClueOnTable, next: Card): Interpretation[] {
  if (!couldBe(read.candidates, next) || read.facts.isTrash(next, read.focus)) return [];
  if (isPlayable(read.table.moment, next)) return [readAs("play", next, ["play-clue"])];
  if (!read.uses("delayed-play-clue")) return [];
  return [readAs("play", next, ["play-clue", "delayed-play-clue"])];
}

/** The connections that supply a suit's cards from the one it needs next, in rank order. */
interface Chain {
  readonly connections: readonly Connection[];
  readonly conventions: readonly ConventionId[];
  /** How many of the connections are prompts, not cards that play anyway. */
  readonly prompts: number;
}

/**
 * Play clues on the cards past `next`, each with a chain of connections supplying every card from
 * `next` up to it. A chain grows one card at a time, while the clue may still ask for it (`allows`).
 */
function connectedPlay(
  read: ClueOnTable,
  next: Card,
  chain: Chain = { connections: [], conventions: [], prompts: 0 },
): Interpretation[] {
  const rank = RANKS.find((each) => each === next.rank + 1);
  if (rank === undefined) return [];
  const card = { suit: next.suit, rank };
  return connectionsFor(read, next, chain).flatMap(({ connection, conventions }) => {
    const longer: Chain = {
      connections: [...chain.connections, connection],
      conventions: uniqBy([...chain.conventions, ...conventions]),
      prompts: chain.prompts + (conventions.includes("prompt") ? 1 : 0),
    };
    const multiPrompt = longer.prompts > 1 ? ["multi-prompt" as const] : [];
    if (!allows(read, longer)) return [];
    // Trash can't be the focus, but a chain can pass through it: a clued card the table already
    // knows is the card plays anyway.
    const here =
      couldBe(read.candidates, card) && !read.facts.isTrash(card, read.focus)
        ? [
            readAs(
              "play",
              card,
              ["play-clue", ...longer.conventions, ...multiPrompt],
              [...longer.connections],
            ),
          ]
        : [];
    return [...here, ...connectedPlay(read, card, longer)];
  });
}

/**
 * Whether a clue can ask for `chain`: any number of cards that play anyway (`delayed-play-clue`),
 * plus one prompt or one finesse. With `multi-prompt`, any number of prompts and no finesse.
 */
function allows({ uses }: ClueOnTable, { connections, prompts }: Chain): boolean {
  const finesses = connections.filter(({ kind }) => kind === "finesse").length;
  if (finesses + prompts <= 1) return true;
  return finesses === 0 && uses("multi-prompt");
}

/**
 * The ways `card` could be supplied, once `chain` has supplied the cards before it, so that a play
 * clue past it makes sense. In turn order from the clue giver:
 *
 * - A prompt: any seat but the giver's (the receiver's included) has clued cards that could be
 *   `card`, other than the ones `chain` already prompts. If those cards were going to play anyway
 *   it is a delayed play clue, not a prompt.
 * - A finesse: a seat that plays after the giver and before the receiver has no such clued card
 *   (`prompts-before-finesses`), and `card` is playable now, so their finesse position blind-plays.
 *   Only the first card of a chain can be playable now, so a clue finesses one card at most.
 */
function connectionsFor(
  read: ClueOnTable,
  card: Card,
  chain: Chain,
): { connection: Connection; conventions: ConventionId[] }[] {
  const { table, given, focus, facts, uses } = read;
  const { moment, common } = table;
  const seats = seatsAfter(given.giver, read.view.config.numPlayers);
  const prompted = new Set(
    chain.connections.flatMap(({ kind, ids }) => (kind === "prompt" ? [ids[0]!] : [])),
  );
  // Once the chain has played, `card` is the card its suit needs next.
  const isNext = (other: Card) =>
    other.suit === card.suit ? other.rank === card.rank : facts.isNext(other);
  const result: { connection: Connection; conventions: ConventionId[] }[] = [];

  for (const seat of seats) {
    const beforeReceiver = seats.indexOf(seat) < seats.indexOf(given.target);
    const ids = moment.hands[seat]!.filter(
      (id) =>
        id !== focus && !prompted.has(id) && isClued(moment, id) && couldBe(common[id]!, card),
    );
    if (ids.length > 0) {
      const anyway = ids.every((id) => common[id]!.every(isNext));
      const kind = anyway ? "delayed-play-clue" : "prompt";
      if (!uses(kind)) continue;
      const conventions: ConventionId[] = [kind];
      if (!anyway && beforeReceiver && uses("prompts-before-finesses")) {
        conventions.push("prompts-before-finesses");
      }
      result.push({ connection: { kind: "prompt", seat, card, ids }, conventions });
    } else if (beforeReceiver && uses("finesse") && isPlayable(moment, card)) {
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
function applyReading(view: PlayerView, table: Table, reading: ClueReading): Note[] {
  const { moment, level } = table;
  const common = [...table.common];
  const facts = tableFacts(view, table);
  const focusIdentities = focusCards(reading);
  const means = focusIdentities.length > 0;
  // The card the focus is under every interpretation, if they agree.
  const focusIdentity = identity(focusIdentities);

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
    // The focus narrows to its interpretations, and no two clued cards are the same card, when the
    // reading settles (`resolve`).
    const goodTouch =
      id !== reading.focus && !isClued(moment, id) && means && applies("good-touch", level);
    // Good Touch: a newly touched card will play one day, so it is not trash, and not the focus's
    // card. The focus's reading comes first: if that leaves nothing, the card is bad touched.
    const willPlay = (card: Card) =>
      !facts.isTrash(card, id) && !(focusIdentity && sameCard(focusIdentity, card));
    common[id] = goodTouch ? narrowed(touched, willPlay) : touched;
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
  type State = { table: Table; readings: readonly PastReading[] };
  const deduce = (state: State): State => {
    const settled = { ...state.table, common: settle(view, state.table, state.readings) };
    const ruled = ruleOut(settled, state.readings, last);
    return { table: { ...settled, ...narrow(settled, ruled) }, readings: ruled };
  };
  // Settling and narrowing only remove cards, so equal sizes mean nothing changed.
  const unchanged = (a: State, b: State) =>
    a.readings === b.readings &&
    a.table.finessed.length === b.table.finessed.length &&
    sameSizes(a.table.common, b.table.common);
  return fixpoint({ table, readings }, deduce, unchanged);
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
    (couldBe(table.common[reading.focus]!, interpretation.focusIdentity) &&
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
    (id) => hand.includes(id) && couldBe(table.common[id]!, connection.card),
  );
}

/**
 * Common knowledge narrowed to what each clue's remaining interpretations allow, and the cards they
 * all agree are finessed.
 */
function narrow(
  table: Table,
  readings: readonly PastReading[],
): { common: Note[]; finessed: CardId[] } {
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
function narrowNote(notes: Note[], id: CardId, cards: Note) {
  notes[id] = narrowed(notes[id]!, (card) => couldBe(cards, card));
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
 * card in a hand), and under Good Touch no two clued cards are the same identity, unless a save
 * may have copied one (`mayCopy`). A note is never narrowed to nothing, so a misread clue leaves
 * it as it was.
 */
function settle(view: PlayerView, table: Table, readings: readonly ClueReading[] = []): Note[] {
  const { moment, level, config } = { ...table, config: view.config };
  const copy = mayCopy(readings);
  const common = [...table.common];
  const inHand = new Set(moment.hands.flat());
  // Discarded cards are public. (Played cards are filled in from their play events. A card in the
  // draw pile then may be visible to the viewer now, but it was hidden from the table.)
  for (const id of moment.discardPile) common[id] = [view.cards[id]!.card!];

  const known = (id: CardId) => identity(common[id]!);
  let changed = true;
  while (changed) {
    changed = false;
    const accounted = new Map<string, number>();
    const count = (card: Card) => accounted.set(key(card), (accounted.get(key(card)) ?? 0) + 1);
    for (const id of moment.discardPile) count(view.cards[id]!.card!);
    for (const suit of config.suits) {
      for (const rank of RANKS) if (rank <= stackHeight(moment, suit)) count({ suit, rank });
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
        if (hasPlayed(moment, card)) return false;
        return !cluedKnown.some(
          (other) => other !== id && !copy(id, other) && sameCard(known(other)!, card),
        );
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
 * cards are also not any clued card they can see in another hand, unless a save may have copied it
 * (`mayCopy`). Each pending clue keeps only the
 * interpretations that fit what the viewer knows, which can pin down the focus or a connecting card:
 * a player who sees the focus of a clue knows whether they were prompted or finessed.
 */
export function privateKnowledge(view: Sight, knowledge: Knowledge): Note[] {
  const { moment, common, level, readings } = knowledge;
  const copy = mayCopy(readings);
  const visibleClued = moment.hands
    .flat()
    .filter((id) => isClued(moment, id))
    .flatMap((id) => {
      const card = view.cards[id]!.card;
      return card ? [{ id, card }] : [];
    });
  const goodTouched = possibilities(view, (id) => {
    const note = common[id]!;
    if (!isClued(moment, id) || !applies("good-touch", level)) return note;
    return narrowed(
      note,
      (card) => !visibleClued.some((seen) => !copy(id, seen.id) && sameCard(seen.card, card)),
    );
  });

  // If the table misread a clue, what the viewer sees can rule out every card the table allows.
  // Such a card falls back to what the rules allow.
  const rules = possibilities(view);
  const fallBack = (notes: Note[]) =>
    notes.map((note, id) => (note.length > 0 ? note : rules[id]!));
  /** Each pending clue narrowed to the interpretations that fit what the viewer knows. */
  const applyReadings = (known: Note[]): Note[] => {
    const could = (id: CardId, card: Card) => couldBe(known[id]!, card);
    const notes = [...known];
    const read = new Set<CardId>();
    for (const reading of readings) {
      const live = pending(reading).filter(
        (interpretation) =>
          could(reading.focus, interpretation.focusIdentity) &&
          !twoSaveSeen(view, reading, interpretation) &&
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
      read.add(reading.focus);
      for (const [id, cards] of pinned(knowledge, live, could)) {
        narrowNote(notes, id, cards);
        read.add(id);
      }
    }
    // A card a clue's reading pins down counts as seen, so a Good Touch guess about another card
    // can't take the last copy of its identity: that other card is bad touched instead.
    const settled: Sight = {
      config: view.config,
      cards: view.cards.map((cardView) => {
        const note = notes[cardView.id]!;
        return cardView.card === null && read.has(cardView.id) && note.length === 1
          ? { ...cardView, card: note[0]! }
          : cardView;
      }),
    };
    return fallBack(possibilities(settled, (id) => notes[id]!));
  };
  return fixpoint(fallBack(goodTouched), applyReadings, sameSizes);
}

/**
 * Whether the viewer can tell `interpretation` is a 2 Save the giver wouldn't give: by the Visible
 * Rule, they saw the other copy off its holder's chop (`2-save`). The table can't see every hand, so
 * only a player who sees that copy rules it out.
 */
function twoSaveSeen(view: Sight, reading: ClueReading, interpretation: Interpretation): boolean {
  if (!interpretation.conventions.includes("2-save")) return false;
  return reading.giverSawOffChop.some((id) => {
    const card = view.cards[id]!.card;
    return card !== null && sameCard(card, interpretation.focusIdentity);
  });
}

export type TableFacts = ReturnType<typeof tableFacts>;

/**
 * Facts about the table that every player agrees on. With `clue`, the facts its focus is read with:
 * the clue already narrows the receiver's other cards, so the focus can't duplicate a clued card
 * the clue pins down (a blue card that was b1 or b3, touched again by a 1 clue). That counts for
 * trash only: a pinned card still connects to the focus as a prompt, not as a card the suit has.
 */
export function tableFacts(
  view: PlayerView,
  table: Table,
  clue?: GivenClue & { readonly focus: CardId },
) {
  const { moment, common } = table;
  const { config } = view;

  /** What the table knows a card is after `clue`, if any, has narrowed it. */
  const narrowedByClue = (id: CardId): Note => {
    const note = common[id]!;
    if (clue === undefined || id === clue.focus || !moment.hands[clue.target]!.includes(id)) {
      return note;
    }
    const fits = (card: Card) => clueMatches(card, clue.clue) === clue.touched.includes(id);
    // If an earlier misread ruled out what the clue now says, the note stays as it was.
    return note.some(fits) ? note.filter(fits) : note;
  };
  /** Clued (or finessed) cards whose identity the whole table knows, from `note`. */
  const gottenBy = (note: (id: CardId) => Note) =>
    moment.hands
      .flat()
      .filter((id) => countsAsClued(table, id))
      .flatMap((id) => {
        const card = identity(note(id));
        return card ? [{ id, card }] : [];
      });
  const gotten = gottenBy((id) => common[id]!);
  const gottenAfterClue = clue === undefined ? gotten : gottenBy(narrowedByClue);
  const discarded = (card: Card) =>
    moment.discardPile.filter((id) => sameCard(view.cards[id]!.card!, card)).length;
  const stack = (card: Card) => stackHeight(moment, card.suit);

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
    /**
     * Trash: can never play, or another gotten card (not `self`) is already this card, counting the
     * cards `clue` pins down.
     */
    isTrash: (card: Card, self: CardId) =>
      !reachable(card) ||
      gottenAfterClue.some(({ id, card: other }) => id !== self && sameCard(other, card)),
    /** Critical: still needed, and every other copy has been discarded. */
    isCritical: (card: Card) => reachable(card) && discarded(card) === copies(config, card) - 1,
  };
}
