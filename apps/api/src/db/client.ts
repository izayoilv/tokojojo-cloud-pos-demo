import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://tokojojo:tokojojo_dev@127.0.0.1:5432/tokojojo";

export const sql = postgres(connectionString, { max: 10 });
export const db = drizzle(sql, { schema });
