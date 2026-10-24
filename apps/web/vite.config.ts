import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from a subfolder (PR previews)
  base: "./",
});
