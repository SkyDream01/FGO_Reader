import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createTranslationApp } from "./server/translation-api.mjs";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const translationApp = createTranslationApp({ env });

  return {
    plugins: [
      react(),
      {
        name: "fgo-reader-translation-api",
        configureServer(server) {
          server.middlewares.use("/translation-api", translationApp);
        },
      },
    ],
    server: {
      proxy: {
        "/atlas-api": {
          target: "https://api.atlasacademy.io",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/atlas-api/, ""),
        },
      },
    },
  };
});
