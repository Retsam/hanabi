// Small generic helpers.

/** `items` without repeats, keeping the first of each, where `same` says when two are the same. */
export function uniqBy<T>(items: readonly T[], same: (a: T, b: T) => boolean = Object.is): T[] {
  return items.filter((item, i) => items.findIndex((other) => same(other, item)) === i);
}
