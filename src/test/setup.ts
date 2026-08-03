import '@testing-library/jest-dom';

// jsdom ships no ResizeObserver. dnd-kit measures droppable containers through it,
// so without this every drag silently finds zero drop targets.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

// jsdom's DOMRect lacks fromRect, which dnd-kit's rect math calls.
if (typeof DOMRect !== 'undefined' && !DOMRect.fromRect) {
  DOMRect.fromRect = (r: DOMRectInit = {}) =>
    new DOMRect(r.x ?? 0, r.y ?? 0, r.width ?? 0, r.height ?? 0);
}
