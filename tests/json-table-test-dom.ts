import { JSDOM } from "jsdom";
import { vi } from "vitest";

export function installJsonTableDom() {
  const dom =
    globalThis.window && globalThis.document
      ? { window: globalThis.window }
      : new JSDOM("<!doctype html><html><body></body></html>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    DocumentFragment: dom.window.DocumentFragment,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    Node: dom.window.Node,
    PointerEvent: dom.window.PointerEvent,
    getComputedStyle: dom.window.getComputedStyle,
  });
  Object.assign(dom.window.HTMLElement.prototype, {
    attachEvent: vi.fn(),
    detachEvent: vi.fn(),
  });
}
