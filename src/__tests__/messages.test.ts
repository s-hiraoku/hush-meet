import { describe, it, expect } from "vitest";
import { en, ja } from "../messages.ts";

describe("i18n messages", () => {
  it("en and ja have the same keys", () => {
    const enKeys = Object.keys(en).sort();
    const jaKeys = Object.keys(ja).sort();
    expect(enKeys).toEqual(jaKeys);
  });

  it("no empty messages in en", () => {
    for (const [key, entry] of Object.entries(en)) {
      expect(entry.message, `en.${key} should not be empty`).not.toBe("");
    }
  });

  it("no empty messages in ja", () => {
    for (const [key, entry] of Object.entries(ja)) {
      expect(entry.message, `ja.${key} should not be empty`).not.toBe("");
    }
  });

  it("placeholders are consistent between en and ja", () => {
    for (const key of Object.keys(en)) {
      const enPlaceholders = en[key].placeholders;
      const jaPlaceholders = ja[key].placeholders;

      if (enPlaceholders) {
        expect(jaPlaceholders, `ja.${key} should have placeholders`).toBeDefined();
        expect(Object.keys(jaPlaceholders!).sort()).toEqual(Object.keys(enPlaceholders).sort());
      } else {
        expect(jaPlaceholders, `ja.${key} should not have placeholders`).toBeUndefined();
      }
    }
  });

  it("placeholder tokens appear in message text", () => {
    for (const [key, entry] of Object.entries(en)) {
      if (entry.placeholders) {
        for (const name of Object.keys(entry.placeholders)) {
          expect(entry.message, `en.${key} should contain $${name.toUpperCase()}$`).toContain(
            `$${name.toUpperCase()}$`,
          );
        }
      }
    }
    for (const [key, entry] of Object.entries(ja)) {
      if (entry.placeholders) {
        for (const name of Object.keys(entry.placeholders)) {
          expect(entry.message, `ja.${key} should contain $${name.toUpperCase()}$`).toContain(
            `$${name.toUpperCase()}$`,
          );
        }
      }
    }
  });
});
