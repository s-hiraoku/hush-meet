import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "__MSG_extName__",
  version: "1.0.5",
  description: "__MSG_extDescription__",
  default_locale: "en",
  permissions: ["storage"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module" as const,
  },
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
