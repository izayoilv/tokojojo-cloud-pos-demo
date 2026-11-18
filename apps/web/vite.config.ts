import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/graphql": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
