#!/usr/bin/env node
/**
 * Generates multilingual docs HTML from templates + i18n JSON files.
 *
 * Usage: node scripts/generate-docs.mjs
 *
 * Source files:
 *   docs/_templates/*.html.tmpl  — HTML templates with {{key.subkey}} placeholders
 *   docs/_i18n/*.json            — translation strings per language
 *
 * Output:
 *   docs/{page}.html             — Japanese (root)
 *   docs/{lang}/{page}.html      — other languages
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOCS = join(ROOT, "docs");
const TEMPLATES_DIR = join(DOCS, "_templates");
const I18N_DIR = join(DOCS, "_i18n");

const LANG_NAMES = {
  ja: "日本語",
  en: "English",
  de: "Deutsch",
  zh: "中文",
  ko: "한국어",
  es: "Español",
  fr: "Français",
};

const ROOT_LANG = "ja";

const templates = {};
for (const file of readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".html.tmpl"))) {
  const page = file.replace(".html.tmpl", "");
  templates[page] = readFileSync(join(TEMPLATES_DIR, file), "utf-8");
}

const bundles = {};
for (const file of readdirSync(I18N_DIR).filter((f) => f.endsWith(".json"))) {
  const lang = file.replace(".json", "");
  bundles[lang] = JSON.parse(readFileSync(join(I18N_DIR, file), "utf-8"));
}

const langs = Object.keys(bundles);

function navLangLinks(currentLang) {
  return langs
    .filter((l) => l !== currentLang)
    .map((l) => {
      const isRoot = currentLang === ROOT_LANG;
      const link = l === ROOT_LANG ? (isRoot ? "./" : "../") : isRoot ? `${l}/` : `../${l}/`;
      return `<a href="${link}">${LANG_NAMES[l]}</a>`;
    })
    .join("\n        ");
}

function resolve(data, path) {
  const parts = path.split(".");
  let val = data;
  for (const p of parts) {
    if (val == null) return undefined;
    val = val[p];
  }
  return val;
}

function render(template, lang, navLinks, data) {
  return template
    .replace(/\{\{lang\}\}/g, lang)
    .replace(/\{\{nav_lang_links\}\}/g, navLinks)
    .replace(/\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g, (_match, key) => {
      const val = resolve(data, key);
      if (val === undefined) {
        console.warn(`  [WARN] Missing key "${key}" for lang="${lang}"`);
        return `{{${key}}}`;
      }
      return val;
    });
}

// Pre-create output directories
for (const lang of langs) {
  if (lang !== ROOT_LANG) {
    mkdirSync(join(DOCS, lang), { recursive: true });
  }
}

// Generate all pages
for (const lang of langs) {
  const data = bundles[lang];
  const navLinks = navLangLinks(lang);
  const outDir = lang === ROOT_LANG ? DOCS : join(DOCS, lang);

  for (const [page, template] of Object.entries(templates)) {
    writeFileSync(join(outDir, `${page}.html`), render(template, lang, navLinks, data), "utf-8");
  }
}

const generated = langs.length * Object.keys(templates).length;
console.log(
  `✓ Generated ${generated} files (${langs.length} languages × ${Object.keys(templates).length} pages)`,
);
for (const lang of langs) {
  const dir = lang === ROOT_LANG ? "docs/" : `docs/${lang}/`;
  const pages = Object.keys(templates)
    .map((p) => `${p}.html`)
    .join(", ");
  console.log(`  ${lang} (${LANG_NAMES[lang]}): ${dir} → ${pages}`);
}
