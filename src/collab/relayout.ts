import { useEffect, useState } from "react";

/** The element carrying `name="value"`, the value escaped for a selector. */
export function byAttr(name: string, value: string): Element | null {
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
  return document.querySelector(`[${name}="${escaped}"]`);
}

/** Whether any of a box is inside the viewport. */
export function onScreen(r: DOMRect): boolean {
  return r.bottom >= 0 && r.right >= 0 && r.top <= window.innerHeight && r.left <= window.innerWidth;
}

/**
 * Redraws while anything is shown, so a ring or a pointer follows its
 * target through scrolling, resizing and the page changing under it.
 */
export function useRelayout(active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame: ReturnType<typeof setTimeout> | number | undefined;
    const bump = () => {
      if (frame !== undefined) return;
      const draw = () => {
        frame = undefined;
        setTick((t) => t + 1);
      };
      frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(draw) : setTimeout(draw, 16);
    };
    const timer = setInterval(bump, 250);
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => {
      clearInterval(timer);
      if (typeof frame === "number" && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      else clearTimeout(frame);
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
    };
  }, [active]);
}

