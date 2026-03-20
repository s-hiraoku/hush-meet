import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Hush Meet",
  version: "0.1.0",
  description:
    "Google Meetで話していない時に自動でミュートし、雑音を防止します",
  permissions: ["storage"],
  host_permissions: ["https://meet.google.com/*"],
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Hush Meet",
  },
  content_scripts: [
    {
      matches: ["https://meet.google.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  icons: {
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
});
