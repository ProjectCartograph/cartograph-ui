// The kinds a change set is named after first: the work it defines.
const WORK = ["Project", "Programme", "Operation", "Portfolio"];

/** The item a change set is named after: the first piece of work in it,
 * else its first item (cartograph-ui#90). */
export function namesAfter<T extends { kind: string }>(items: T[]): T | undefined {
  return items.find((i) => WORK.includes(i.kind)) ?? items[0];
}
