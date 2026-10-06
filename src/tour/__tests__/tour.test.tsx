/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { copy } from "@/copy";
import { STEPS } from "../steps";
import { TourProvider } from "../TourProvider";
import { toured, useTour } from "../tourContext";

let path = "/";
const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) => select({ location: { pathname: path } }),
}));

const tc = copy.tour;
const indexOf = (key: string) => STEPS.findIndex((s) => s.key === key);

function placeAt(el: Element, r: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON() {} }) as DOMRect;
}

function Start({ at }: { at?: number }) {
  const tour = useTour();
  return (
    <button type="button" onClick={() => (at === undefined ? tour.start() : tour.go(at))}>
      begin
    </button>
  );
}

function mount(page: React.ReactNode, at?: number) {
  const view = render(
    <TourProvider>
      {page}
      <Start at={at} />
    </TourProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "begin" }));
  return view;
}

beforeEach(() => {
  path = "/";
  navigate.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

// The tour rests a pixie on what it explains and lets the person do each
// thing: it moves on by itself once a step is done, walks the rail a stop
// at a time, offers to go where a step happens, and ends with a project of
// their own started, in seven steps.
describe("the guided tour", () => {
  it("is seven steps, and opens with the pixie on the home question", async () => {
    expect(STEPS).toHaveLength(7);
    mount(
      <div data-cartograph-region="home">
        <textarea aria-label="What are you working on?" />
      </div>,
    );
    placeAt(document.querySelector('[data-cartograph-region="home"] textarea')!, { left: 300, top: 200, width: 600, height: 120 });
    expect(screen.getByRole("heading", { name: tc.steps.home.title })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-slot="tour-pixie"]')).not.toBeNull());
    expect(document.querySelector('[data-slot="tour-spotlight"]')).not.toBeNull();
  });

  it("walks the rail a stop at a time, from the strategy outwards", async () => {
    mount(<nav data-cartograph-region="rail" />, indexOf("rail"));
    const order = ["strategy", "gaps", "indicators", "projects", "portfolios", "programmes", "operations"] as const;
    for (const key of order) {
      expect(await screen.findByRole("heading", { name: tc.stops[key].title })).toBeInTheDocument();
      expect(screen.getByText(tc.count(indexOf("rail") + 1, 7))).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: tc.next }));
    }
    expect(await screen.findByRole("heading", { name: tc.steps.walker.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: tc.back }));
    expect(await screen.findByRole("heading", { name: tc.stops.operations.title })).toBeInTheDocument();
  });

  // The project walker is a tutorial the tour leads into itself, saying
  // that it does not affect the workspace.
  it("takes the person to the project walker by itself", async () => {
    path = "/glossary";
    mount(<div />, indexOf("walker"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/projects/start" }));
    expect(document.querySelector('[data-slot="tour-box"]')?.textContent).toMatch(/affects your workspace/);
  });

  // While the walker has questions left it takes the guide's Next, so it
  // moves only when the person asks; then Next is the tour's again.
  it("lets the walker take Next while it has questions left", async () => {
    path = "/projects/start";
    window.history.pushState({}, "", "/projects/start");
    let presses = 0;
    let release = () => {};
    function Walker() {
      const tour = useTour();
      return (
        <button type="button" onClick={() => (release = tour.takeNext(() => (++presses, true)))}>
          take
        </button>
      );
    }
    render(
      <TourProvider>
        <div data-step="about" />
        <Walker />
        <Start at={indexOf("walker")} />
      </TourProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "begin" }));
    fireEvent.click(screen.getByRole("button", { name: "take" }));
    fireEvent.click(await screen.findByRole("button", { name: tc.next }));
    expect(presses).toBe(1);
    expect(await screen.findByRole("heading", { name: tc.stops.walkAbout.title })).toBeInTheDocument();
    act(() => release());
    fireEvent.click(screen.getByRole("button", { name: tc.next }));
    expect(presses).toBe(1);
    expect(await screen.findByRole("heading", { name: tc.steps.placement.title })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });

  it("shows an example teammate to this person only, while explaining working together", async () => {
    mount(
      <>
        <header data-cartograph-region="header" />
        <main data-cartograph-region="main" />
      </>,
      indexOf("together"),
    );
    placeAt(document.querySelector('[data-cartograph-region="header"]')!, { left: 0, top: 0, width: 1000, height: 56 });
    placeAt(document.querySelector('[data-cartograph-region="main"]')!, { left: 0, top: 56, width: 1000, height: 700 });
    expect(await screen.findByRole("heading", { name: tc.stops.multiplayer.title })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="tour-demo"]')).not.toBeNull();
  });

  it("ends on Escape, and is not offered again", async () => {
    mount(<div />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toured()).toBe(true);
  });

  it("follows the project walker a question at a time", async () => {
    path = "/projects/start";
    window.history.pushState({}, "", "/projects/start");
    const { rerender } = mount(<div data-step="about" />, indexOf("walker"));
    expect(await screen.findByRole("heading", { name: tc.stops.walkAbout.title })).toBeInTheDocument();
    rerender(
      <TourProvider>
        <div data-step="goals" />
        <Start at={indexOf("walker")} />
      </TourProvider>,
    );
    expect(await screen.findByRole("heading", { name: tc.stops.walkOutcomes.title })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });

  it("goes to the walker when a project is started another way, but not when begun there", async () => {
    path = "/";
    window.history.pushState({}, "", "/");
    const { rerender } = mount(<div />);
    expect(await screen.findByRole("heading", { name: tc.steps.home.title })).toBeInTheDocument();
    // Started from a suggestion on the home page.
    path = "/projects/start";
    window.history.pushState({}, "", "/projects/start");
    rerender(
      <TourProvider>
        <div data-step="about" />
        <Start />
      </TourProvider>,
    );
    expect(await screen.findByRole("heading", { name: tc.stops.walkAbout.title })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });
});
