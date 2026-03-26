/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const warn = vi.fn();

describe("meet DOM helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    warn.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds toolbar by role attribute", async () => {
    document.body.innerHTML = `<div role="toolbar" id="toolbar"></div>`;
    const { findBottomToolbar } = await import("../content/meet-dom.ts");
    expect(findBottomToolbar()?.id).toBe("toolbar");
  });

  it("finds toolbar by bottom bar heuristic", async () => {
    document.body.innerHTML = `
      <div jscontroller="x" jsaction="y">
        <div id="fallback" jscontroller="z"></div>
      </div>
    `;
    const bar = document.getElementById("fallback") as HTMLDivElement;
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      bottom: 900,
      height: 80,
      left: 0,
      right: 1200,
      top: 820,
      width: 1000,
      x: 0,
      y: 820,
      toJSON: () => ({}),
    });

    const { findBottomToolbar } = await import("../content/meet-dom.ts");
    expect(findBottomToolbar()?.id).toBe("fallback");
  });

  it("returns null when no bottom bar candidate matches the toolbar heuristic", async () => {
    document.body.innerHTML = `
      <div jscontroller="x" jsaction="y">
        <div id="non-toolbar" jscontroller="z"></div>
      </div>
    `;
    const bar = document.getElementById("non-toolbar") as HTMLDivElement;
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      bottom: 200,
      height: 40,
      left: 0,
      right: 200,
      top: 160,
      width: 100,
      x: 0,
      y: 160,
      toJSON: () => ({}),
    });

    const { findBottomToolbar } = await import("../content/meet-dom.ts");
    expect(findBottomToolbar()).toBeNull();
  });

  it("finds mute button in toolbar and ignores participant controls", async () => {
    document.body.innerHTML = `
      <div role="toolbar">
        <div role="listitem">
          <button aria-label="mute participant">Participant</button>
        </div>
        <button id="mute" aria-label="Turn off microphone"></button>
      </div>
    `;
    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)?.id).toBe("mute");
    expect(warn).not.toHaveBeenCalled();
  });

  it("finds a clickable ancestor for tooltip matches inside the toolbar", async () => {
    document.body.innerHTML = `
      <div role="toolbar">
        <button id="wrapped"><span data-tooltip="microphone">Mic</span></button>
      </div>
    `;
    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)?.id).toBe("wrapped");
  });

  it("falls back to generic toolbar buttons when only text content matches", async () => {
    document.body.innerHTML = `
      <div role="toolbar">
        <button id="text-match">Mute microphone now</button>
      </div>
    `;
    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)?.id).toBe("text-match");
  });

  it("skips participant controls during generic toolbar scanning", async () => {
    document.body.innerHTML = `
      <div role="toolbar">
        <div role="listitem">
          <button>Mute participant microphone</button>
        </div>
        <button id="toolbar-generic">Mute my microphone</button>
      </div>
    `;
    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)?.id).toBe("toolbar-generic");
  });

  it("falls back to document-wide search when no toolbar is present", async () => {
    document.body.innerHTML = `
      <div data-participant-id="p1">
        <button aria-label="Turn off microphone" id="participant-button"></button>
      </div>
      <button aria-label="Turn off microphone" id="global-button"></button>
    `;
    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)?.id).toBe("global-button");
  });

  it("returns null when no mute button can be found", async () => {
    document.body.innerHTML = `<div role="toolbar"><button>Camera</button></div>`;
    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)).toBeNull();
  });

  it("warns and keeps searching when selector queries throw", async () => {
    document.body.innerHTML = `
      <div role="toolbar">
        <button id="mute" aria-label="Turn off microphone"></button>
      </div>
    `;
    const originalQuerySelector = Element.prototype.querySelector;
    const originalQuerySelectorAll = Element.prototype.querySelectorAll;

    vi.spyOn(Element.prototype, "querySelector").mockImplementation(function <
      K extends keyof HTMLElementTagNameMap,
    >(this: Element, selector: string): HTMLElementTagNameMap[K] | null {
      if (selector === 'button[aria-label*="マイク"]') {
        throw new Error("bad selector");
      }
      return originalQuerySelector.call(this, selector) as HTMLElementTagNameMap[K] | null;
    });

    vi.spyOn(Element.prototype, "querySelectorAll").mockImplementation(function <
      K extends keyof HTMLElementTagNameMap,
    >(this: Element, selector: string): NodeListOf<HTMLElementTagNameMap[K]> {
      if (selector === "button, [role='button']") {
        throw new Error("bad selector all");
      }
      return originalQuerySelectorAll.call(this, selector) as NodeListOf<HTMLElementTagNameMap[K]>;
    });

    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)?.id).toBe("mute");
    expect(warn).toHaveBeenCalled();
  });

  it("returns null and warns when querySelectorAll throws during document fallback", async () => {
    document.body.innerHTML = `<div></div>`;
    const originalQuerySelectorAll = Document.prototype.querySelectorAll;

    vi.spyOn(Document.prototype, "querySelectorAll").mockImplementation(function <
      K extends keyof HTMLElementTagNameMap,
    >(this: Document, selector: string): NodeListOf<HTMLElementTagNameMap[K]> {
      if (selector === 'button[aria-label*="マイク"]') {
        throw new Error("document selector all failed");
      }
      return originalQuerySelectorAll.call(this, selector) as NodeListOf<HTMLElementTagNameMap[K]>;
    });

    const { findMuteButton } = await import("../content/meet-dom.ts");
    expect(findMuteButton(warn)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("infers mute state from button attributes and labels", async () => {
    const { inferMuteStateFromButton } = await import("../content/meet-dom.ts");
    const attrButton = document.createElement("button");
    attrButton.setAttribute("data-is-muted", "true");
    expect(inferMuteStateFromButton(attrButton)).toBe(true);

    const pressedButton = document.createElement("button");
    pressedButton.setAttribute("aria-pressed", "false");
    expect(inferMuteStateFromButton(pressedButton)).toBe(true);

    const labelButton = document.createElement("button");
    labelButton.setAttribute("aria-label", "Turn off microphone");
    expect(inferMuteStateFromButton(labelButton)).toBe(false);

    const tooltipButton = document.createElement("button");
    tooltipButton.setAttribute("data-tooltip", "Turn on microphone");
    expect(inferMuteStateFromButton(tooltipButton)).toBe(true);

    const emptyButton = document.createElement("button");
    expect(inferMuteStateFromButton(emptyButton)).toBeNull();

    expect(inferMuteStateFromButton(null)).toBeNull();
  });
});
