import { describe, it, expect } from "vitest";

import { mergeIntoYAML } from "../store";

const original = `apiVersion: cartograph/v1
kind: Programme
metadata:
  id: market-access-programme
  name: Market Access Programme
spec:
  name: Market Access Programme
  aim: Sell more of the season direct to retail buyers.
  leadTeam: member-services-team
  supportingTeams: [finance-team, quality-team]
  goals: [grow-member-livelihoods, members-reach-more-buyers]
`;

function manifest(spec: Record<string, unknown>) {
  return {
    apiVersion: "cartograph/v1",
    kind: "Programme",
    metadata: { id: "market-access-programme", name: "Market Access Programme" },
    spec,
  };
}

const unchanged = {
  name: "Market Access Programme",
  aim: "Sell more of the season direct to retail buyers.",
  leadTeam: "member-services-team",
  supportingTeams: ["finance-team", "quality-team"],
  goals: ["grow-member-livelihoods", "members-reach-more-buyers"],
};

describe("a save writes over the file it came from", () => {
  it("changes nothing when nothing changed", () => {
    expect(mergeIntoYAML(original, manifest(unchanged))).toBe(original);
  });

  it("changes one line for one edit, and keeps every style around it", () => {
    const out = mergeIntoYAML(original, manifest({ ...unchanged, aim: "Sell more, sooner." }));
    // The edit landed.
    expect(out).toContain("aim: Sell more, sooner.");
    // And the flow sequences beside it are untouched: writing the whole
    // document from a plain object turns these into block lists, which is
    // a diff nobody asked for.
    expect(out).toContain("supportingTeams: [finance-team, quality-team]");
    expect(out).toContain("goals: [grow-member-livelihoods, members-reach-more-buyers]");
  });

  it("keeps the order the file was written in, never the alphabet's", () => {
    const out = mergeIntoYAML(original, manifest({ ...unchanged, source: "A board minute" }));
    const spec = out.slice(out.indexOf("spec:"));
    const keys = [...spec.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    expect(keys).toEqual(["name", "aim", "leadTeam", "supportingTeams", "goals", "source"]);
  });

  it("removes a key the spec no longer has", () => {
    const { goals: _dropped, ...rest } = unchanged;
    const out = mergeIntoYAML(original, manifest(rest));
    expect(out).not.toContain("goals:");
    expect(out).toContain("supportingTeams: [finance-team, quality-team]");
  });

  it("writes the whole document when there is nothing to merge into", () => {
    const out = mergeIntoYAML(undefined, manifest({ name: "New" }));
    expect(out).toContain("kind: Programme");
    expect(out).toContain("name: New");
  });

  it("falls back rather than losing an edit when the original will not parse", () => {
    const out = mergeIntoYAML("spec:\n  - [unbalanced\n", manifest({ name: "Still saved" }));
    expect(out).toContain("name: Still saved");
  });
});
