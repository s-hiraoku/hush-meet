import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("i18n helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("chrome", {
      i18n: {
        getUILanguage: vi.fn(() => "ja-JP"),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses browser language for auto locale", async () => {
    const { t } = await import("../i18n.ts");
    expect(t("modeOff")).toBe("オフ");
  });

  it("switches locale explicitly and falls back for unknown keys", async () => {
    const { getLocale, setLocale, t } = await import("../i18n.ts");
    setLocale("en");
    expect(getLocale().modeOff.message).toBe("Off");
    expect(t("modePushToTalk")).toBe("Push-to-Talk");
    expect(t("missingKey")).toBe("missingKey");
  });

  it("notifies locale listeners and unsubscribes cleanly", async () => {
    const { onLocaleChange, setLocale } = await import("../i18n.ts");
    const listener = vi.fn();
    const unsubscribe = onLocaleChange(listener);

    setLocale("en");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setLocale("ja");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("replaces placeholder tokens and falls back to english for unknown browser locales", async () => {
    vi.resetModules();
    vi.stubGlobal("chrome", {
      i18n: {
        getUILanguage: vi.fn(() => "fr-FR"),
      },
    });

    const { setLocale, t } = await import("../i18n.ts");
    setLocale("en");
    expect(t("secondsUnit", "3")).toBe("3s");
    setLocale("auto");
    expect(t("modeAuto")).toBe("Auto");
  });

  it("falls back for unsupported explicit locales and leaves placeholders untouched without values", async () => {
    const { setLocale, t } = await import("../i18n.ts");
    setLocale("fr");
    expect(t("modeOff")).toBe("Désactivé");
    expect(t("secondsUnit")).toBe("$VALUE$s");
  });
});
