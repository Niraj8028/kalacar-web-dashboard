import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.VITE_API_BASE_URL || "http://127.0.0.1:3000";

  return {
    plugins: [react()],
    server: {
      host: "localhost",
      port: 5173,
      proxy: {
        // Keep the browser's Host (localhost:5173) so Google sign-in returns to the dashboard.
        "/api": { target: apiBase, changeOrigin: false },
        "/images": apiBase,
        "/uploads": apiBase,
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
