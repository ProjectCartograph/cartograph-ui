import { describe, expect, it } from "vitest";

import { checkText } from "../MergeBar";
import { locksMerge } from "../locks";

const check = (path: string, message: string) => ({ id: `required:${path}`, path, message, state: "block" }) as never;

// What stops a merge names the field it is about (#86).
describe("a field to fill before merging", () => {
  it("is named by the record's own word for it", () => {
    expect(checkText(check("/spec/purpose", "Needed before this can be merged."))).toBe("Fill in the purpose");
  });

  it("says which date, where the key alone would not", () => {
    expect(checkText(check("/spec/baseline/date", "Write it as a year and month, YYYY-MM."))).toBe("The baseline date: write it as a year and month, YYYY-MM.");
  });
});

// A field not filled in yet merges and is said as what is left; only a
// record that cannot be saved as it stands locks the merge (engine
// docs/adr/0035).
describe("what locks a merge", () => {
  const unfilled = { id: "required:/spec/team", path: "/spec/team", message: "Not filled in yet. It can be merged without it; fill it in before the work is handed off.", state: "block" };
  it("lets a field not filled in yet merge, said as the field to fill", () => {
    expect(locksMerge(unfilled)).toBe(false);
    expect(checkText(unfilled as never)).toBe("Fill in the team");
  });
  it("locks on a record that cannot be saved as it stands", () => {
    expect(locksMerge({ id: "malformed:/spec/nonsense", message: "additional properties 'nonsense' not allowed" })).toBe(true);
  });
  it("locks as an engine before it did on a field its schema requires", () => {
    expect(locksMerge({ id: "required:/spec/team", message: "Needed before this can be merged." })).toBe(true);
  });
});
