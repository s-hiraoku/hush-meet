/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ModeGrid", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("chrome", {
      i18n: {
        getUILanguage: vi.fn(() => "en-US"),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders four modes and calls onSelect with the clicked mode", async () => {
    const { MODES } = await import("../constants.ts");
    const { ModeGrid } = await import("../popup/ModeGrid.tsx");
    const onSelect = vi.fn();

    render(<ModeGrid isLoaded mode={MODES.autoOff} onSelect={onSelect} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    const pttButton = screen.getByRole("button", { name: /Push-to-Talk$/ });
    expect((pttButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith(MODES.off);
  });

  it("disables all mode buttons while storage is loading", async () => {
    const { MODES } = await import("../constants.ts");
    const { ModeGrid } = await import("../popup/ModeGrid.tsx");

    render(<ModeGrid isLoaded={false} mode={MODES.off} onSelect={vi.fn()} />);

    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
