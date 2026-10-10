import { useEffect, useState, type RefObject } from "react";

import { copy } from "@/copy";

const so = copy.projects.outline;

interface Heading {
  id: string;
  text: string;
  level: number;
}

const FIELDS = 'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), [role="combobox"]:not([aria-disabled="true"])';
const FOCUSABLE = 'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([aria-disabled="true"]), button:not([disabled])';

/** What the outline lists and the keys move between: each heading, and
 * each section with none of its own, named by its first label (Approved
 * funding, Mandate), in the order they are on the page. */
function targetsIn(root: HTMLElement): { el: HTMLElement; text: string; level: number }[] {
  const out: { el: HTMLElement; text: string; level: number }[] = [];
  root.querySelectorAll<HTMLElement>("h2, h3, section").forEach((el) => {
    if (el.closest("[role=dialog]") || el.classList.contains("sr-only")) return;
    if (el.tagName === "SECTION") {
      if (el.querySelector("h2, h3")) return;
      const label = el.querySelector<HTMLElement>("label, legend");
      const text = label?.textContent?.trim();
      if (text) out.push({ el, text, level: 3 });
      return;
    }
    const text = el.textContent?.trim();
    if (text) out.push({ el, text, level: el.tagName === "H2" ? 2 : 3 });
  });
  return out;
}

function headingsIn(root: HTMLElement): Heading[] {
  return targetsIn(root).map((t, i) => {
    if (!t.el.id) t.el.id = `outline-${i}`;
    return { id: t.el.id, text: t.text, level: t.level };
  });
}

/** Moves a section from the one at the top of the view, and focuses the
 * first field after it, so the next thing typed lands there. */
function jump(root: HTMLElement, delta: number) {
  const hs = targetsIn(root).map((t) => t.el);
  if (hs.length === 0) return;
  // The sticky outline covers the top of the view.
  const line = 120;
  let current = -1;
  hs.forEach((h, i) => {
    if (h.getBoundingClientRect().top <= line) current = i;
  });
  const target = hs[Math.min(hs.length - 1, Math.max(0, current + delta))];
  goTo(target);
}

/** Brings a target into view below the outline, the cursor in its first
 * field. */
function goTo(target: HTMLElement) {
  target.style.scrollMarginTop = "7rem";
  target.scrollIntoView({ block: "start", behavior: "smooth" });
  focusAfter(target);
}

function focusAfter(h: HTMLElement) {
  // A field, not the help beside a heading: what is typed next lands in it.
  const fields = Array.from(document.querySelectorAll<HTMLElement>(FIELDS));
  const after = (el: HTMLElement) => (h === el || h.contains(el) || h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && !el.closest("[role=dialog]");
  (fields.find(after) ?? Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).find(after))?.focus({ preventScroll: true });
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "combobox");

/**
 * Where a long stage goes, from the keyboard (#32): an outline of its
 * headings, kept in view, each a jump; Alt+Down and Alt+Up (or J and K
 * when not typing) move a section and put the cursor in its first field;
 * Ctrl+Enter takes the next step. Reading one section and writing in
 * another no longer means reaching for the mouse to scroll.
 */
export function SectionOutline({ root, onNext }: { root: RefObject<HTMLElement | null>; onNext?: () => void }) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const read = () => setHeadings((prev) => {
      const next = headingsIn(el);
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    read();
    const watch = new MutationObserver(read);
    watch.observe(el, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [root]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = root.current;
      if (!el) return;
      const plain = !e.altKey && !e.ctrlKey && !e.metaKey && !typing(e.target);
      if ((e.altKey && e.key === "ArrowDown") || (plain && e.key === "j")) {
        e.preventDefault();
        jump(el, 1);
      } else if ((e.altKey && e.key === "ArrowUp") || (plain && e.key === "k")) {
        e.preventDefault();
        jump(el, -1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [root, onNext]);

  if (headings.length < 2) return null;
  return (
    <nav aria-label={so.label} className="sticky top-0 z-20 -mx-2 flex flex-col gap-1 rounded-lg bg-card/95 px-2 py-2 backdrop-blur" data-cartograph-region="section-outline">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <li className="text-muted-foreground">{so.onThisPage}</li>
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`underline-offset-4 hover:underline ${h.level === 2 ? "font-medium" : "text-muted-foreground"}`}
              onClick={(e) => {
                e.preventDefault();
                const target = document.getElementById(h.id);
                if (target) goTo(target);
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-muted-foreground">{so.keys}</p>
    </nav>
  );
}
