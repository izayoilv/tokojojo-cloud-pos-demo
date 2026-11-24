import { defineConfig } from "drizzle-kit";

import { loadEnvFile, rootEnvFile } from "./src/db/env.ts";

loadEnvFile(rootEnvFile);

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Export it or add it to the repo-root .env (copy .env.example).",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
