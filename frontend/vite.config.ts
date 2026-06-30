import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE || "/ui/",
  plugins: [vue()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
