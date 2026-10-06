import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { MultiplayerDemo } from "./MultiplayerDemo";
import { Pixie } from "./Pixie";
import { useSidebar } from "@/components/ui/sidebar";
import { inRail, STEPS, type TourStep } from "./steps";
import { markToured, TourContext, type TourApi } from "./tourContext";

const tc = copy.tour;

/** Where the tour is: a step, and the stop within it. */
type Place = { at: number; stop: number };

// The place survives a reload in this tab, so following a link the tour
// asked for never loses it.
const AT = "cartograph:tour-at";

function readPlace(): Place | null {
  try {
    const v = sessionStorage.getItem(AT);
    if (v === null) return null;
    const [a, s] = v.split(".").map((n) => Number(n) || 0);
    const at = Math.min(Math.max(0, a), STEPS.length - 1);
    return { at, stop: Math.min(Math.max(0, s ?? 0), (STEPS[at].stops?.length ?? 1) - 1) };
  } catch {
    return null;
  }
}

function writePlace(p: Place | null) {
  try {
    if (p === null) sessionStorage.removeItem(AT);
    else sessionStorage.setItem(AT, `${p.at}.${p.stop}`);
  } catch {
    // The tour still runs; a reload ends it.
  }
}

/**
 * The guided tour: a pixie that rests on what to look at or click, a box
 * beside it saying what it is, and the person doing each thing themselves,
 * from the home page, through what the rail holds, to a project of their
 * own started and its sections explained, and how working together looks.
 * Nothing is blocked while it runs: the page stays live under it, and a
 * step the person does moves it on by itself.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<Place | null>(readPlace);
  const put = useCallback((p: Place | null) => {
    setPlace(p);
    writePlace(p);
  }, []);
  const go = useCallback((to: number) => put({ at: Math.min(Math.max(0, to), STEPS.length - 1), stop: 0 }), [put]);
  const end = useCallback(() => {
    put(null);
    markToured();
  }, [put]);
  const start = useCallback(() => go(0), [go]);
  // A screen the tour drives may take Next (the tutorial walker).
  const taken = useRef<(() => boolean) | null>(null);
  const takeNext = useCallback((handler: () => boolean) => {
    taken.current = handler;
    return () => {
      if (taken.current === handler) taken.current = null;
    };
  }, []);
  const api = useMemo<TourApi>(() => ({ at: place?.at ?? null, start, go, end, takeNext }), [place, start, go, end, takeNext]);
  return (
    <TourContext.Provider value={api}>
      {children}
      {place ? <TourLayer place={place} put={put} end={end} taken={taken} /> : null}
    </TourContext.Provider>
  );
}

type Box = { left: number; top: number; width: number; height: number };

/** The first of the selectors with a match on screen, laid out. */
function find(selectors: string[] | undefined): Element | null {
  for (const selector of selectors ?? []) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

function TourLayer({
  place,
  put,
  end,
  taken,
}: {
  place: Place;
  put: (p: Place | null) => void;
  end: () => void;
  taken: { current: (() => boolean) | null };
}) {
  const { at, stop } = place;
  const step = STEPS[at];
  const here = step.stops?.[stop];
  // A followed walker: the question on screen, as the person moves.
  const [followed, setFollowed] = useState<string | null>(null);
  const following = step.follow && followed ? step.follow[followed] : undefined;
  const target = useMemo(() => (here ? here.target : following ? [`[data-step="${followed}"]`] : step.target), [here, following, followed, step]);
  const demo = here?.demo;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const onScreen = !step.on || step.on.test(path);
  const [box, setBox] = useState<Box | null>(null);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const moved = useRef(-1);
  const scrolled = useRef("");
  // The screen the step began on.
  const startedOn = useRef(window.location.pathname);
  useEffect(() => {
    startedOn.current = window.location.pathname;
  }, [at]);
  // A step that takes the person to its screen itself: the project walker,
  // which the tutorial fills in.
  useEffect(() => {
    if (step.auto && step.go && !onScreen) void navigate({ to: step.go });
  }, [at, step, onScreen, navigate]);

  const next = useCallback(() => {
    // The screen the tour is driving moves first, while it has more to
    // show: the tutorial walker's next question.
    if (taken.current?.()) return;
    if (step.stops && stop < step.stops.length - 1) put({ at, stop: stop + 1 });
    else put({ at: Math.min(at + 1, STEPS.length - 1), stop: 0 });
  }, [at, stop, step, put, taken]);
  const back = useCallback(() => {
    if (stop > 0) put({ at, stop: stop - 1 });
    else if (at > 0) put({ at: at - 1, stop: Math.max(0, (STEPS[at - 1].stops?.length ?? 1) - 1) });
  }, [at, stop, put]);

  // On a phone the rail is folded into a menu: opened for what is in it,
  // and closed again after, unless what is pointed at is on the page.
  const sidebar = useSidebar(true);
  const mobile = !!sidebar?.isMobile;
  const setOpenMobile = sidebar?.setOpenMobile;
  useEffect(() => {
    if (!mobile || !setOpenMobile) return;
    const list = target ?? [];
    const onPage = find(list.filter((s) => !inRail(s)));
    setOpenMobile(!onPage && list.some(inRail));
  }, [mobile, setOpenMobile, target, at, stop, path]);

  // Where the target is, every frame while the tour runs: pages move,
  // panels open, and the pixie follows. Only a change is drawn.
  useEffect(() => {
    let frame = 0;
    let last = "";
    const tick = () => {
      const el = onScreen ? find(target) : null;
      const r = el?.getBoundingClientRect();
      const next = r ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null;
      const key = JSON.stringify(next) + window.innerWidth + "x" + window.innerHeight;
      if (key !== last) {
        last = key;
        setBox(next);
        setView({ w: window.innerWidth, h: window.innerHeight });
      }
      if (el && r && scrolled.current !== `${at}.${stop}`) {
        scrolled.current = `${at}.${stop}`;
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (step.follow) {
        const q = document.querySelector("[data-step]")?.getAttribute("data-step") ?? null;
        setFollowed((prev) => (prev === q ? prev : q));
      }
      // Reached a later step's screen another way during this step (a
      // suggestion on the home page, New): the tour goes there. Only on
      // arriving, so a tour begun on such a screen still starts at its
      // start.
      const now = window.location.pathname;
      const ahead = now !== startedOn.current ? STEPS.findIndex((s, i) => i > at && s.enter?.test(now)) : -1;
      if (ahead > at) {
        if (moved.current !== at) {
          moved.current = at;
          put({ at: ahead, stop: 0 });
        }
      }
      // A step the person does moves on once it is done.
      else if (step.until && moved.current !== at) {
        const done = (step.until.path && step.until.path.test(window.location.pathname)) || (step.until.shown && find([step.until.shown]));
        if (done) {
          moved.current = at;
          put({ at: at + 1, stop: 0 });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [at, stop, step, target, onScreen, put]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [end]);

  const words = here ? tc.stops[here.key] : following ? tc.stops[following] : tc.steps[step.key];
  const last = at === STEPS.length - 1;
  const lit = box ? { left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 } : null;

  return createPortal(
    <div data-slot="tour" data-keeps-sidebar className="pointer-events-none fixed inset-0 z-[70]">
      {lit ? (
        <div
          className="absolute rounded-xl ring-2 ring-primary/60 transition-all duration-500 ease-standard motion-reduce:transition-none"
          style={{ ...lit, boxShadow: "0 0 0 200vmax rgb(10 10 15 / 0.28)" }}
          data-slot="tour-spotlight"
        />
      ) : (
        <div className="absolute inset-0 bg-black/25 animate-in fade-in duration-300" />
      )}
      {demo ? <MultiplayerDemo walking={demo === "walking"} /> : null}
      {lit ? <Pixie box={lit} /> : null}
      <Bubble
        step={step}
        at={at}
        stop={stop}
        title={words.title}
        body={words.body}
        box={box}
        view={view}
        here={onScreen}
        last={last}
        next={next}
        back={back}
        end={end}
        onGo={() => step.go && void navigate({ to: step.go })}
      />
    </div>,
    document.body,
  );
}

const WIDTH = 340;

function Bubble({
  step,
  at,
  stop,
  title,
  body,
  box,
  view,
  here,
  last,
  next,
  back,
  end,
  onGo,
}: {
  step: TourStep;
  at: number;
  stop: number;
  title: string;
  body: string;
  box: Box | null;
  view: { w: number; h: number };
  here: boolean;
  last: boolean;
  next: () => void;
  back: () => void;
  end: () => void;
  onGo: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Its own height, to keep it on screen: measured as it changes.
  const [height, setHeight] = useState(200);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // On a phone the box spans the screen: the page gets room below its
  // end to scroll clear of it, so nothing is left under it.
  const narrow = view.w < 640;
  useEffect(() => {
    if (!narrow) return;
    const body = document.body;
    const before = body.style.paddingBottom;
    body.style.paddingBottom = `${height + 24}px`;
    return () => {
      body.style.paddingBottom = before;
    };
  }, [narrow, height]);
  // Beside what is lit, never over it: to its right where there is room,
  // else its left, else below or above it; on a phone, along the bottom;
  // with nothing lit, in the middle.
  let style: CSSProperties;
  let origin = "center";
  const GAP = 28;
  const clampTop = (t: number) => Math.min(Math.max(16, t), view.h - height - 16);
  const clampLeft = (l: number) => Math.min(Math.max(16, l), view.w - WIDTH - 16);
  // On a phone: across the screen, away from what is lit.
  if (view.w < 640) style = box && box.top + box.height / 2 > view.h / 2 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 };
  else if (!box) style = { left: (view.w - WIDTH) / 2, top: Math.max(16, (view.h - height) / 2), width: WIDTH };
  else if (box.left + box.width + GAP + WIDTH <= view.w - 16) {
    origin = "left top";
    style = { left: box.left + box.width + GAP, top: clampTop(box.top), width: WIDTH };
  } else if (box.left - GAP - WIDTH >= 16) {
    origin = "right top";
    style = { left: box.left - GAP - WIDTH, top: clampTop(box.top), width: WIDTH };
  } else if (box.top + box.height + GAP + height <= view.h - 16) {
    origin = "top";
    style = { left: clampLeft(box.left + Math.min(box.width / 2, 120)), top: box.top + box.height + GAP, width: WIDTH };
  } else {
    origin = "bottom";
    style = { left: clampLeft(box.left + Math.min(box.width / 2, 120)), top: Math.max(16, box.top - GAP - height), width: WIDTH };
  }
  const stops = step.stops?.length ?? 0;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className="cartograph-bubble-in pointer-events-auto absolute flex flex-col gap-2.5 rounded-2xl bg-popover p-3.5 sm:gap-3 sm:p-4 text-popover-foreground shadow-xl ring-1 ring-foreground/10 transition-[left,top] duration-500 ease-standard motion-reduce:transition-none"
      style={{ ...style, transformOrigin: origin }}
      data-slot="tour-box"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
          {tc.count(at + 1, STEPS.length)}
          {/* Where in the step's stops: a dot each, the one on filled. */}
          {stops > 1 ? (
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: stops }, (_, i) => (
                <span key={i} className={`size-1.5 rounded-full transition-colors duration-300 ${i === stop ? "bg-primary" : "bg-muted-foreground/30"}`} />
              ))}
            </span>
          ) : null}
        </span>
        <button type="button" onClick={end} aria-label={tc.end} title={tc.end} className="-m-1 rounded p-1 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-4" />
        </button>
      </div>
      {/* Only the words change from stop to stop; the buttons stay, so a
          touch on them is never on something gone. */}
      <h2 key={`t${at}.${stop}`} id="tour-title" className="cartograph-word text-base font-semibold leading-snug">
        {title}
      </h2>
      {/* The words arrive a few at a time, as someone saying them. */}
      {body ? (
        <p key={`b${at}.${stop}`} className="text-sm text-muted-foreground" aria-live="polite">
          {body.split(" ").map((w, i) => {
            // A word between asterisks is the one to stress.
            const stressed = /^\*[^*]+\*\W*$/.test(w);
            const word = stressed ? <em className="text-foreground">{w.replace(/\*/g, "")}</em> : w;
            return (
              <span key={i} className="cartograph-word" style={{ animationDelay: `${Math.min(i * 18, 900)}ms` }}>
                {word}{" "}
              </span>
            );
          })}
        </p>
      ) : null}
      {!here ? (
        step.go ? (
          <Button type="button" size="sm" variant="outline" className="self-start" onClick={onGo}>
            {tc.goThere}
          </Button>
        ) : (
          <p className="text-sm font-medium">{tc.openProject}</p>
        )
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={back} className={at === 0 && stop === 0 ? "invisible" : ""}>
          <ArrowLeft />
          {tc.back}
        </Button>
        {last ? (
          <Button type="button" size="sm" onClick={end}>
            {tc.done}
          </Button>
        ) : (
          <Button type="button" size="sm" variant={step.until && !step.auto ? "outline" : "default"} onClick={next}>
            {tc.next}
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}
