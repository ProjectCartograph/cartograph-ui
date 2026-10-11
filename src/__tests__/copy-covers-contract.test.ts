import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { copy } from "@/copy";
import { SHEET_KINDS } from "@/surfaces/sheet/schema";

// The contract is the source of truth for what a directory entry holds;
// copy.ts is what a person reads. A property added to a schema without a
// label here shows up in the Add dialog as its raw property name, which is
// how "qualityIssues" and "countBasis" would reach a Permanent Secretary.
const schemaDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../contract/schemas",
);

function specProperties(kind: string): string[] {
  const file = path.join(schemaDir, `${kind.toLowerCase()}.schema.json`);
  const doc = JSON.parse(readFileSync(file, "utf8"));
  // A deprecated property is read, never shown, so it needs no copy.
  const props: Record<string, { description?: string }> = doc.properties.spec.properties ?? {};
  return Object.keys(props).filter((p) => !String(props[p].description ?? "").startsWith("Deprecated"));
}

describe("every directory field a person can see has copy", () => {
  it.each(SHEET_KINDS)("%s names all of its spec properties", (kind) => {
    const labels = copy.sheets.fields[kind] ?? {};
    const missing = specProperties(kind).filter((p) => !labels[p]);
    expect(missing).toEqual([]);
  });
});
