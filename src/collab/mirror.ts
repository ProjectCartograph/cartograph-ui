// Where a character index sits inside a text input or a textarea, measured
// with a mirror: an invisible copy of the control with the same box and
// font, holding the text up to the index and a marker after it. The
// marker's offset is the caret's, before the control's own scroll.

const COPIED = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

/** A point in the control, relative to its border box's top left. */
export interface CaretPoint {
  left: number;
  top: number;
  height: number;
}

/** The caret at `index` inside `el`, in pixels from its top left. */
export function caretPoint(el: HTMLInputElement | HTMLTextAreaElement, index: number): CaretPoint {
  const style = window.getComputedStyle(el);
  const mirror = document.createElement("div");
  const s = mirror.style;
  for (const prop of COPIED) s[prop] = style[prop];
  s.position = "absolute";
  s.visibility = "hidden";
  s.top = "0";
  s.left = "-9999px";
  const textarea = el instanceof HTMLTextAreaElement;
  s.whiteSpace = textarea ? "pre-wrap" : "pre";
  s.overflowWrap = textarea ? "break-word" : "normal";
  if (!textarea) s.height = "auto";

  const value = el.value;
  mirror.textContent = value.slice(0, index);
  const marker = document.createElement("span");
  // Something after the index, so the marker has a box even at the end.
  marker.textContent = value.slice(index) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;
  const point = {
    left: marker.offsetLeft + (parseFloat(style.borderLeftWidth) || 0) - el.scrollLeft,
    top: marker.offsetTop + (parseFloat(style.borderTopWidth) || 0) - el.scrollTop,
    height: lineHeight,
  };
  mirror.remove();
  return point;
}
