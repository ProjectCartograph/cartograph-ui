import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";


/**
 * The parts the vaults hold, read back.
 *
 * Since 2026-09-29 Cartograph stores a problem, a change and an aim as parts and
 * shows them as parts, each under its own label, and never joins them into
 * one sentence (TAXONOMY.md D19). So what has to hold is that each part
 * stands on its own: it is stored as a part, and it carries none of the
 * joining words the old builders added ("because", "so", "so that") at its
 * front, which would only read correctly glued to its neighbour.
 *
 * Read from the shipped vaults rather than from fixtures: a rule that
 * holds only against text written to prove it holds is not a rule.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== ".cartograph") walk(p, out);
    } else if (entry.endsWith(".yaml")) out.push(p);
  }
  return out;
}

const VAULTS = ["./examples/minimal"].filter((v) => {
  try {
    return statSync(v).isDirectory();
  } catch {
    return false;
  }
});

const docs: Doc[] = VAULTS.flatMap((vault) =>
  walk(vault)
    .flatMap((f) => parseAllDocuments(readFileSync(f, "utf8")).map((d) => d.toJS()))
    .filter((d) => d && typeof d === "object"),
);

const parts: string[] = [];
const rawParts: unknown[] = [];
for (const d of docs) {
  const lines = d.kind === "Project" ? (d.spec?.summary?.problems ?? []) : (d.spec?.problems ?? []);
  for (const line of lines) {
    rawParts.push(line.problem, line.change);
    for (const v of [line.problem?.situation, line.problem?.cause, line.change?.what, line.change?.gain]) {
      if (typeof v === "string" && v.trim()) parts.push(v);
    }
  }
  if (d.kind === "Programme" && d.spec?.aim) {
    rawParts.push(d.spec.aim);
    for (const v of [d.spec.aim.change, d.spec.aim.gain]) {
      if (typeof v === "string" && v.trim()) parts.push(v);
    }
  }
}

/** What stops a part reading on its own. */
function dependent(part: string): string[] {
  const bad: string[] = [];
  if (/^(because|so that|so|and|but)\b/i.test(part.trim())) bad.push("starts with a joining word");
  if (/[,;]$/.test(part.trim())) bad.push("ends mid-sentence");
  if (/\s{2,}/.test(part)) bad.push("has a double space");
  return bad;
}

describe("every part the vaults hold", () => {
  it("has some to check", () => {
    expect(VAULTS.length).toBeGreaterThan(0);
    expect(parts.length).toBeGreaterThan(5);
  });

  // The thing stored is the input. A file holding a composed sentence is
  // an older shape, and the server rewrites it on read.
  it("stores parts, not sentences", () => {
    for (const part of rawParts) {
      if (part === undefined) continue;
      expect(typeof part, JSON.stringify(part)).toBe("object");
    }
  });

  it("reads on its own, with no joining word left over", () => {
    for (const p of parts) {
      expect(dependent(p), `${dependent(p).join(", ")}: ${p}`).toEqual([]);
    }
  });
});
