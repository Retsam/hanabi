// Small generic helpers.

/** `items` without repeats, keeping the first of each, where `same` says when two are the same. */
export function uniqBy<T>(items: readonly T[], same: (a: T, b: T) => boolean = Object.is): T[] {
  return items.filter((item, i) => items.findIndex((other) => same(other, item)) === i);
}

/**
 * Applies `step` until it stops changing anything, as `same` judges it, and returns the result. For
 * deductions where each conclusion can lead to another.
 */
export function fixpoint<T>(start: T, step: (value: T) => T, same: (a: T, b: T) => boolean): T {
  for (let value = start; ;) {
    const next = step(value);
    if (same(value, next)) return next;
    value = next;
  }
}

/** The other seats in turn order after `seat`, nearest first. */
export function seatsAfter(seat: number, players: number): number[] {
  return Array.from({ length: players - 1 }, (_, i) => (seat + i + 1) % players);
}
