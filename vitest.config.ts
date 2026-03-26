import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/constants.ts",
        "src/i18n.ts",
        "src/messages.ts",
        "src/meet-controls.ts",
        "src/mode-control.ts",
        "src/shortcut.ts",
        "src/content/config.ts",
        "src/content/meet-dom.ts",
        "src/content/mute-action.ts",
        "src/content/shortcut-controller.ts",
        "src/content/state-machine.ts",
        "src/content/storage-sync.ts",
        "src/content/timers.ts",
        "src/popup/ModeGrid.tsx",
        "src/popup/ShortcutSetting.tsx",
        "src/popup/storage-actions.ts",
      ],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      thresholds: {
        perFile: true,
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
    environment: "node",
    globals: true,
  },
});
