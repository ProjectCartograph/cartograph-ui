import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { useTour } from "@/tour/tourContext";
import { useGoalTree } from "@/surfaces/goals/api";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

/** How fast the tutorial types and moves on: a character, and a pause to
 * read what was filled in. Tests set them low. */
export const pace = { char: 32, beat: 1800 };

type Step = "about" | "gaps" | "goals" | "groups" | "team" | "details" | "ready";

/**
 * Starting a project as a tutorial: the walker fills itself in, typing
 * what it is about and its name a character at a time and choosing from
 * what the workspace already has, and saves nothing: no project, and
 * nothing named along the way. It moves to the next question only when
 * the person presses the guide's Next, so they read each at their own
 * pace. At the end it opens a project the workspace already has, so the
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
  // Stable for the tour's life, so the script is not restarted by it.
  const { takeNext } = useTour();
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
    // The guide's Next, taken while the tutorial has questions left: each
    // press lets the next question show. A press before the filling-in is
    // done is held, so it is never lost.
    let pressed = 0;
    let wake: (() => void) | null = null;
    const release = takeNext(() => {
      pressed++;
      wake?.();
      return true;
    });
    const nextPressed = async () => {
      while (live && pressed === 0) await new Promise<void>((r) => (wake = r));
      pressed = Math.max(0, pressed - 1);
    };
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
      await nextPressed();
      if (!live) return;
      w().show("gaps");
      await wait(pace.beat / 2);
      if (gap) w().setGaps([gap.value]);
      await nextPressed();
      if (!live) return;
      w().show("goals");
      await wait(pace.beat / 2);
      const outcome = firstOutcome();
      if (outcome) w().setGoals([outcome]);
      await nextPressed();
      if (!live) return;
      w().show("groups");
      await wait(pace.beat / 2);
      const group = held.current.groups.data?.options[0];
      if (group) w().setGroups([group.value]);
      await nextPressed();
      if (!live) return;
      w().show("team");
      await wait(pace.beat / 2);
      const team = held.current.teams.data?.options[0];
      if (team) w().setTeam(team.value);
      await nextPressed();
      if (!live) return;
      w().show("ready");
      await wait(pace.beat / 2);
      if (live) await type(copy.tour.sample.name, w().setName);
      await nextPressed();
      if (!live) return;
      // The last Next leaves the walker: the tour moves on when the
      // project's page opens.
      release();
      // Nothing is saved: a project already here is opened instead.
      const projects = await client.list("Project").catch(() => []);
      if (!live) return;
      const first = projects[0];
      if (first) void navigate({ to: "/projects/$id/initiation/goals", params: { id: first.id } });
      else void navigate({ to: "/projects" });
    })();
    return () => {
      live = false;
      wake?.();
      release();
    };
  }, [active, client, navigate, takeNext]);
}
