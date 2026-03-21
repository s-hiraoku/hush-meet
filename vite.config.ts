import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

export default defineConfig({
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [react(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
});
