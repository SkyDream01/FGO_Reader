import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { createTranslationApp } from "./server/translation-api.mjs";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const localEnvPath = path.resolve(process.cwd(), ".env.local");
  const translationApp = createTranslationApp({ env, localEnvPath });

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
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react-vendor",
                test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              },
            ],
          },
        },
      },
    },
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
