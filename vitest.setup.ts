/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom/vitest';

// jsdom ships neither of these, and the Radix popper the Popover (and so
// the Combobox) positions itself with calls both the moment a popup
// opens. Without them a test that opens any picker dies on a
// ReferenceError before it can assert anything.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!('DOMRect' in globalThis)) {
  globalThis.DOMRect = class {
    constructor(
      readonly x = 0,
      readonly y = 0,
      readonly width = 0,
      readonly height = 0,
    ) {}
    get top() {
      return this.y;
    }
    get left() {
      return this.x;
    }
    get right() {
      return this.x + this.width;
    }
    get bottom() {
      return this.y + this.height;
    }
    static fromRect(r?: DOMRectInit) {
      return new DOMRect(r?.x, r?.y, r?.width, r?.height);
    }
    toJSON() {
      return { ...this };
    }
  } as unknown as typeof DOMRect;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Radix's Select trigger asks the pointer event's target whether it holds
// capture before it opens; jsdom's Element has neither method.
for (const name of ['hasPointerCapture', 'releasePointerCapture', 'setPointerCapture'] as const) {
  if (!(name in Element.prototype)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any)[name] = name === 'hasPointerCapture' ? () => false : () => {};
  }
}
