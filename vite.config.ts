import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve("index.html"),
        webots: resolve("webots/org-structure/index.html"),
        chrc: resolve("chrc/org-structure/index.html"),
      },
    },
  },
});
