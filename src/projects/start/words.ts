/** Text within a length, cut at the last whole word that fits, so a
 * limit never leaves half a word (#90). */
export function wordsWithin(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return (at > max / 2 ? cut.slice(0, at) : text.slice(0, max)).replace(/[\s,;:]+$/, "");
}
