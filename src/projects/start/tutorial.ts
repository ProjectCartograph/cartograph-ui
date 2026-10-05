import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { useGoalTree } from "@/surfaces/goals/api";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

/** How fast the tutorial types and moves on: a character, and a pause to
 * read what was filled in. Tests set them low. */
export const pace = { char: 32, beat: 1800 };

type Step = "about" | "gaps" | "goals" | "groups" | "team" | "details" | "ready";

/**
 * Starting a project as a tutorial: the walker fills itself in, typing
 * what it is about and its name a character at a time and choosing from
 * what the workspace already has, a question at a time with a pause to
 * read each, and saves nothing: no project, and nothing named along the
 * way. At the end it opens a project the workspace already has, so the
 * tour can show what a project's page holds.
 */
export function useTutorial(
  active: boolean,
  walker: {
    about: string;
    setAbout: (v: string) => void;
    setGaps: (v: string[]) => void;
    setGoals: (v: string[]) => void;
    setGroups: (v: string[]) => void;
    setTeam: (v: string) => void;
    setName: (v: string) => void;
    show: (s: Step) => void;
  },
) {
  const client = useClient();
  const navigate = useNavigate();
  const gaps = useReferenceOptions("Gap");
  const groups = useReferenceOptions("BeneficiaryGroup");
  const teams = useReferenceOptions("Team");
  const tree = useGoalTree();
  // What the workspace holds, as it stands when each question is reached.
  const held = useRef({ gaps, groups, teams, tree, walker });
  useEffect(() => {
    held.current = { gaps, groups, teams, tree, walker };
  });
  const ran = useRef(false);

  useEffect(() => {
    if (!active || ran.current) return;
    ran.current = true;
    let live = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const type = async (text: string, set: (v: string) => void) => {
      for (let i = 1; i <= text.length && live; i++) {
        set(text.slice(0, i));
        await wait(pace.char);
      }
    };
    const firstOutcome = () => {
      for (const g of held.current.tree.data?.nodes ?? []) for (const o of g.children ?? []) for (const x of o.children ?? []) if (x.level === "outcome") return x.id;
      return undefined;
    };
    void (async () => {
      const w = () => held.current.walker;
      await wait(pace.beat / 2);
      const gap = held.current.gaps.data?.options[0];
      if (live && !w().about.trim()) await type(copy.tour.sample.about(gap?.label), w().setAbout);
      await wait(pace.beat);
      if (!live) return;
      w().show("gaps");
      await wait(pace.beat / 2);
      if (gap) w().setGaps([gap.value]);
      await wait(pace.beat);
      if (!live) return;
      w().show("goals");
      await wait(pace.beat / 2);
      const outcome = firstOutcome();
      if (outcome) w().setGoals([outcome]);
      await wait(pace.beat);
      if (!live) return;
      w().show("groups");
      await wait(pace.beat / 2);
      const group = held.current.groups.data?.options[0];
      if (group) w().setGroups([group.value]);
      await wait(pace.beat);
      if (!live) return;
      w().show("team");
      await wait(pace.beat / 2);
      const team = held.current.teams.data?.options[0];
      if (team) w().setTeam(team.value);
      await wait(pace.beat);
      if (!live) return;
      w().show("ready");
      await wait(pace.beat / 2);
      if (live) await type(copy.tour.sample.name, w().setName);
      await wait(pace.beat * 1.5);
      if (!live) return;
      // Nothing is saved: a project already here is opened instead.
      const projects = await client.list("Project").catch(() => []);
      if (!live) return;
      const first = projects[0];
      if (first) void navigate({ to: "/projects/$id/initiation/goals", params: { id: first.id } });
      else void navigate({ to: "/projects" });
    })();
    return () => {
      live = false;
    };
  }, [active, client, navigate]);
}
