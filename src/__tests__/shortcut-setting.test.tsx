/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ShortcutSetting", () => {
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

  it("shows current shortcut and delegates click and blur", async () => {
    const { ShortcutSetting } = await import("../popup/ShortcutSetting.tsx");
    const onClick = vi.fn();
    const onBlur = vi.fn();

    render(
      <ShortcutSetting
        recordingShortcut={false}
        shortcutKey="Ctrl+Shift+M"
        onBlur={onBlur}
        onClick={onClick}
        onKeyDown={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Ctrl+Shift+M" });
    fireEvent.click(button);
    fireEvent.blur(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("shows recording prompt and forwards keydown while recording", async () => {
    const { ShortcutSetting } = await import("../popup/ShortcutSetting.tsx");
    const onKeyDown = vi.fn();

    render(
      <ShortcutSetting
        recordingShortcut
        shortcutKey="Ctrl+Shift+M"
        onBlur={vi.fn()}
        onClick={vi.fn()}
        onKeyDown={onKeyDown}
      />,
    );

    const button = screen.getByRole("button", { name: "Press keys..." });
    fireEvent.keyDown(button, { key: "M", ctrlKey: true, shiftKey: true });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
