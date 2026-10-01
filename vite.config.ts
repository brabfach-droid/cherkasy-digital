import { pwa } from "./scripts/pwa";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), pwa()],
    base: env.VITE_BASE_PATH || "/cherkasy-digital/",
    build: { chunkSizeWarningLimit: 750 },
  };
});
