/** A number with its thousands grouped, as the reader reads it:
 * 1500000 is 1,500,000. */
export function grouped(n: number): string {
  return n.toLocaleString("en", { maximumFractionDigits: 2 });
}
