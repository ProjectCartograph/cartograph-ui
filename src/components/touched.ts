// Motion answers a person, never a page load (DESIGN_RULES "The interface
// answers"): a pick that is already chosen when a page opens would
// otherwise settle into place as it appears. Until the first press or key
// on the page, the root carries no "touched" mark, and the pick motion is
// off (index.css).

let marked = false;

export function markTouchedOnFirstInput() {
  if (marked || typeof document === "undefined") return;
  marked = true;
  const mark = () => {
    document.documentElement.classList.add("cartograph-touched");
    document.removeEventListener("pointerdown", mark, true);
    document.removeEventListener("keydown", mark, true);
  };
  document.addEventListener("pointerdown", mark, true);
  document.addEventListener("keydown", mark, true);
}
