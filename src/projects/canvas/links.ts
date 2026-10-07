import { parseDocument } from "yaml";

import type { Client, LinkKind } from "@/client/port";
import type { ProjectSpec } from "../types";

/** A node on the project's map: a record, or one of the project's own
 * problems, which live inside the project rather than as records. */
export interface MapNode {
  key: string;
  kind: string;
  id: string;
  name: string;
  level?: string;
  /** For a problem: its id, or "#n" for its position. */
  problem?: string;
}

/** The link a drag from one kind to another makes, if any. */
export function linkFor(from: MapNode, to: MapNode): LinkKind | undefined {
  const pair = `${from.kind}>${to.kind}`;
  switch (pair) {
    case "Problem>Gap":
      return "problem-gap";
    case "Problem>BeneficiaryGroup":
      return "problem-group";
    case "Gap>BeneficiaryGroup":
      return "gap-group";
    case "Gap>Goal":
      return "gap-outcome";
    case "Project>Goal":
      return "project-outcome";
    case "KPI>Gap":
      return "kpi-gap";
    case "Goal>Goal":
      return "goal-parent";
  }
  return undefined;
}

/** The links a node may start, by the kind each reaches. */
export function linksFrom(node: MapNode): { link: LinkKind; target: string }[] {
  switch (node.kind) {
    case "Problem":
      return [
        { link: "problem-gap", target: "Gap" },
        { link: "problem-group", target: "BeneficiaryGroup" },
      ];
    case "Gap":
      return [
        { link: "gap-group", target: "BeneficiaryGroup" },
        { link: "gap-outcome", target: "Goal" },
      ];
    case "Project":
      return [{ link: "project-outcome", target: "Goal" }];
    case "KPI":
      return [{ link: "kpi-gap", target: "Gap" }];
    case "Goal":
      return [{ link: "goal-parent", target: "Goal" }];
  }
  return [];
}

/** Changes one record's YAML in the change set: what a link on another
 * record is saved as. */
async function editRecord(client: Client, kind: string, id: string, edit: (doc: ReturnType<typeof parseDocument>) => void) {
  const view = await client.get(kind, id);
  const doc = parseDocument(view.yaml);
  edit(doc);
  await client.saveWorking(kind, id, doc.toString());
}

function listAt(doc: ReturnType<typeof parseDocument>, path: string[]): string[] {
  return ((doc.getIn(path) as { toJSON(): string[] } | undefined)?.toJSON() ?? []).filter((x) => typeof x === "string");
}

/**
 * Makes or removes a link drawn on the map: on the project, through its
 * store, for what the project holds; on the other record, in the change
 * set, for what that record holds.
 */
export async function setLink(
  client: Client,
  updateSpec: (fn: (s: ProjectSpec) => ProjectSpec) => void,
  problemIndex: (key: string) => number,
  link: LinkKind,
  from: MapNode,
  to: MapNode,
  on: boolean,
) {
  const toggle = (list: string[], id: string) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));
  switch (link) {
    case "problem-gap":
    case "problem-group": {
      const i = problemIndex(from.problem ?? "");
      updateSpec((s) => {
        const problems = [...(s.summary.problems ?? [])];
        const p = problems[i];
        if (!p) return s;
        if (link === "problem-gap") {
          const cited = (p.gaps ?? []).filter((c) => c.gap !== to.id);
          problems[i] = { ...p, gaps: on ? [...cited, { gap: to.id }] : cited.length ? cited : undefined };
        } else {
          problems[i] = { ...p, groups: toggle(p.groups ?? [], to.id) };
        }
        // A group a problem names is one of the project's beneficiaries.
        const beneficiaries = s.summary.beneficiaries ?? [];
        const withGroup = link === "problem-group" && on && !beneficiaries.some((b) => b.group === to.id) ? [...beneficiaries, { group: to.id }] : beneficiaries;
        return { ...s, summary: { ...s.summary, problems, beneficiaries: withGroup } };
      });
      return;
    }
    case "project-outcome":
      updateSpec((s) => ({ ...s, alignment: { ...s.alignment, goals: toggle(s.alignment?.goals ?? [], to.id) } }));
      return;
    case "gap-group":
      return editRecord(client, "Gap", from.id, (doc) => doc.setIn(["spec", "affects"], toggle(listAt(doc, ["spec", "affects"]), to.id)));
    case "gap-outcome":
      return editRecord(client, "Gap", from.id, (doc) => doc.setIn(["spec", "outcomes"], toggle(listAt(doc, ["spec", "outcomes"]), to.id)));
    case "kpi-gap":
      return editRecord(client, "Gap", to.id, (doc) => (on ? doc.setIn(["spec", "measure"], from.id) : doc.deleteIn(["spec", "measure"])));
    case "goal-parent":
      return editRecord(client, "Goal", from.id, (doc) => (on ? doc.setIn(["spec", "parent"], to.id) : doc.deleteIn(["spec", "parent"])));
  }
}
