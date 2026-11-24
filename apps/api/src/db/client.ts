import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Export it or copy .env.example to .env.",
  );
}

export const sql = postgres(databaseUrl);
export const db = drizzle({ client: sql, schema });
