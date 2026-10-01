import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { SHEET_KINDS } from "@/surfaces/sheet/schema";
import { fieldVocab, vocabIcon, vocabLabel, vocabValues, VOCAB_NAMES } from "@/components/vocab";

const schemaDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../contract/schemas",
);

function specProperty(kind: string, property: string) {
  const doc = JSON.parse(readFileSync(path.join(schemaDir, `${kind.toLowerCase()}.schema.json`), "utf8"));
  return doc.properties.spec.properties?.[property] ?? {};
}

describe("marks and words stay together", () => {
  // goalLevel is named by the instance's own tree, not by a fixed word,
  // so it is the one vocabulary with marks and no words of its own.
  const worded = VOCAB_NAMES.filter((name) => name !== "goalLevel");

  it.each(worded)("%s reads as words, never as the stored value", (name) => {
    const unworded = vocabValues(name).filter((value) => vocabLabel(name, value) === value);
    expect(unworded).toEqual([]);
  });

  // A category added to the contract without a mark would fall back to a
  // bare badge, which is how "personRole" reached the screen before.
  it.each(SHEET_KINDS)("%s: every value the contract allows has a mark", (kind) => {
    const missing: string[] = [];
    for (const property of ["category", "refresh", "periodMonths"]) {
      const vocab = fieldVocab(kind, property);
      if (!vocab) continue;
      const prop = specProperty(kind, property);
      const values: (string | number)[] = prop.enum ?? prop["x-cartograph-enum"] ?? [];
      for (const value of values) {
        if (!vocabIcon(vocab, value)) missing.push(`${property}=${String(value)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
