import type { KPISeed } from "./KPIAddDialog";

/** What a new indicator starts from: the one key result's baseline,
 * target and source, where the objectives hold exactly one. With several,
 * which one the indicator reads is not guessed (#87). */
export function kpiSeedOf(objectives: { keyResults?: { baseline?: unknown; target?: unknown; source?: string }[] }[] | undefined): KPISeed | undefined {
  const krs = (objectives ?? []).flatMap((o) => o.keyResults ?? []);
  if (krs.length !== 1) return undefined;
  const [kr] = krs;
  return { baseline: kr.baseline, target: kr.target, source: kr.source };
}
