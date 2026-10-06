import { copy } from "@/copy";

/** One place the pixie rests within a step, with its own words. */
export interface TourStop {
  key: keyof typeof copy.tour.stops;
  /** What it rests on: the first of these on screen, tried in order. */
  target: string[];
  /** Something only this person sees, to show what the stop explains. */
  demo?: "multiplayer" | "walking";
}

/**
 * One step of the tour: what it says, what the pixie rests on, the
 * screen it happens on, and what moves it on. A step the person does
 * (clicking, answering) moves on by itself when it is done; a step with
 * stops moves the pixie from one to the next on Next, and on from the
 * last.
 */
export interface TourStep {
  key: keyof typeof copy.tour.steps;
  /** What it rests on: the first of these on screen, tried in order. None,
   * and the box sits in the middle. */
  target?: string[];
  stops?: TourStop[];
  /** The screen the step is on; elsewhere, the box offers to go there. */
  on?: RegExp;
  /** Where "Take me there" goes. */
  go?: string;
  /** Goes to `go` by itself when the step begins, rather than asking. */
  auto?: boolean;
  /** Moves on by itself once this is true: a screen reached, or a thing on
   * screen. */
  until?: { path?: RegExp; shown?: string };
  /** A walker followed as the person goes: the stop is the question on
   * screen (its data-step), whichever way they move. */
  follow?: Record<string, TourStop["key"]>;
  /** Reaching this screen from an earlier step, by any way (a suggestion
   * on the home page, the projects list, New), brings the tour here. */
  enter?: RegExp;
}

/** A project's own pages, once one is started. */
export const PROJECT = /^\/projects\/(?!start$|new$)[^/]+(\/|$)/;

/** A rail entry, by where it goes: in the rail, or in the menu it folds
 * into on a phone. */
const rail = (href: string) => `:is([data-cartograph-region="rail"], [data-sidebar="sidebar"][data-mobile="true"]) a[href="${href}"]`;

/** Whether a selector is for the rail, which a phone keeps folded away. */
export const inRail = (selector: string) => selector.includes('data-sidebar="sidebar"');

export const STEPS: TourStep[] = [
  { key: "home", target: ['[data-cartograph-region="home"] textarea'], on: /^\/$/, go: "/" },
  // The rail, from the strategy, which holds the rest, outwards.
  {
    key: "rail",
    stops: [
      { key: "strategy", target: [rail("/strategy")] },
      { key: "gaps", target: [rail("/gaps")] },
      { key: "indicators", target: [rail("/kpis")] },
      { key: "projects", target: [rail("/projects")] },
      { key: "portfolios", target: [rail("/portfolios")] },
      { key: "programmes", target: [rail("/programmes")] },
      { key: "operations", target: [rail("/operations")] },
    ],
  },
  {
    key: "walker",
    target: ["[data-step]"],
    on: /^\/projects\/start/,
    enter: /^\/projects\/start/,
    go: "/projects/start",
    auto: true,
    until: { path: PROJECT },
    follow: { about: "walkAbout", gaps: "walkGaps", goals: "walkOutcomes", groups: "walkPeople", team: "walkTeam", details: "walkDetails", ready: "walkReady" },
  },
  { key: "placement", target: ['[data-cartograph-region="about"]'], on: PROJECT, enter: PROJECT },
  {
    key: "sections",
    on: PROJECT,
    stops: [
      { key: "walk", target: ['[data-cartograph-region="section-rail"]', '[data-cartograph-region="stage-stepper"]'] },
      { key: "outline", target: ['[data-cartograph-region="outline"]', '[data-cartograph-region="checks"]'] },
      { key: "versions", target: ['[data-cartograph-region="save-bar"]', '[data-slot="save-state"]'] },
    ],
  },
  {
    key: "together",
    stops: [
      { key: "multiplayer", target: ['[data-slot="tour-demo-person"]', '[data-cartograph-region="header"]'], demo: "multiplayer" },
      { key: "walking", target: ['[data-slot="tour-demo-person"]', '[data-cartograph-region="header"]'], demo: "walking" },
    ],
  },
  { key: "finish" },
];
