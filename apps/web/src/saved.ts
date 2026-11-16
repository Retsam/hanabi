// The game in progress, kept in the browser's localStorage so a reload resumes it. Only the options,
// the replay record and the player's card notes are stored; the state is rebuilt by replaying the
// record's actions.
import { type Replay, replay } from "@hanabi/engine";
import type { Notes } from "./notes.ts";
import type { SessionOptions } from "./session.ts";

export interface SavedGame {
  readonly options: SessionOptions;
  readonly record: Replay;
  /** The player gave up on it before the end; it is kept for review until they start a new game. */
  readonly abandoned?: boolean;
  /** The player's notes on cards. Saves from before notes existed have none. */
  readonly notes?: Notes;
}

/** The part of the Web Storage API this uses, so tests can pass an in-memory one. */
export type GameStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Bump when `SavedGame` changes shape; saves from another version are dropped, not migrated. */
const VERSION = 1;
/**
 * PR previews share main's origin (retsam.github.io), so the key includes the page's path: a
 * preview's save can't clobber main's, nor drop it for not replaying under the preview's rules.
 */
const KEY = `hanabi.currentGame:${typeof location === "undefined" ? "" : location.pathname}`;

/** The saved game, or null if there is none or it no longer replays (it is then removed). */
export function loadGame(storage: GameStorage | null = browserStorage()): SavedGame | null {
  const text = attempt(() => storage?.getItem(KEY)) ?? null;
  if (text === null) return null;
  const game = attempt(() => {
    const stored: unknown = JSON.parse(text);
    if (!isCurrent(stored)) return null;
    // Throws if the engine's rules or the record's shape have changed since it was saved.
    replay(stored.game.record);
    return stored.game;
  });
  if (game === undefined || game === null) clearGame(storage);
  return game ?? null;
}

export function saveGame(game: SavedGame, storage: GameStorage | null = browserStorage()): void {
  attempt(() => storage?.setItem(KEY, JSON.stringify({ version: VERSION, game })));
}

export function clearGame(storage: GameStorage | null = browserStorage()): void {
  attempt(() => storage?.removeItem(KEY));
}

/**
 * Picks on the setup screen that carry over to the next game, by the localStorage key each is
 * kept under. Unlike the game, they aren't scoped to the page's path: a pick is a preference, not
 * something that must replay.
 */
const PREFERENCE_KEYS = { level: "hanabi.level", players: "hanabi.players" } as const;
export type Preference = keyof typeof PREFERENCE_KEYS;

/** The value last picked for `preference`, if it is one of `offered`; otherwise null. */
export function loadPreference<T extends number>(
  preference: Preference,
  offered: readonly T[],
  storage: GameStorage | null = browserStorage(),
): T | null {
  const value = Number(attempt(() => storage?.getItem(PREFERENCE_KEYS[preference])) ?? Number.NaN);
  return offered.find((option) => option === value) ?? null;
}

export function savePreference(
  preference: Preference,
  value: number,
  storage: GameStorage | null = browserStorage(),
): void {
  attempt(() => storage?.setItem(PREFERENCE_KEYS[preference], String(value)));
}

/** Whether a parsed save is from this version. Its record is checked by replaying it. */
function isCurrent(stored: unknown): stored is { version: typeof VERSION; game: SavedGame } {
  return (
    typeof stored === "object" &&
    stored !== null &&
    "version" in stored &&
    stored.version === VERSION
  );
}

/** localStorage, or null where the browser blocks it (some private windows, disabled site data). */
function browserStorage(): GameStorage | null {
  return attempt(() => globalThis.localStorage) ?? null;
}

/** Storage can throw when it is blocked or full; a lost save must never stop the game. */
function attempt<T>(run: () => T): T | undefined {
  try {
    return run();
  } catch {
    return undefined;
  }
}
