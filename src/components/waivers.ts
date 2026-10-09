/** A check an agent left open for its person, with the reason. */
export type LeftCheck = { on?: string; check: string; message: string; reason: string; asked?: string };

/** One missing fact and every check it holds open. */
export type LeftFact = { reason: string; checks: LeftCheck[]; asked?: string };

/**
 * The checks left open, once per reason. One missing figure (a target the
 * document defers) holds open the KPI that waits on it and every aim the
 * KPI measures; the engine gives each the same words, so the person reads
 * the fact once, with what it holds, in the order the agent left them.
 */
export function byReason(left: LeftCheck[]): LeftFact[] {
  const facts = new Map<string, LeftFact>();
  for (const w of left) {
    // A check two missing facts hold open carries both reasons, joined
    // by the engine with "Also:"; it is listed under each.
    for (const part of w.reason.split(/\s+Also:\s+/)) {
      const key = part.trim();
      if (!key) continue;
      const fact = facts.get(key) ?? { reason: key, checks: [] };
      fact.checks.push(w);
      // What the person was asked about it, once: every check the fact
      // holds was left on the same answer.
      fact.asked ??= w.asked?.trim() || undefined;
      facts.set(key, fact);
    }
  }
  return [...facts.values()];
}
