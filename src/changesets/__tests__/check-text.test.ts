import { describe, expect, it } from "vitest";

import { checkText } from "../MergeBar";

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
