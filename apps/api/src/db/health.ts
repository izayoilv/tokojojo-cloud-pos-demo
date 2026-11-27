import { sql } from "./client.ts";

/**
 * Minimal liveness probe for the single store database. It never returns schema
 * details and should be cheap enough to poll from the POS.
 */
export async function checkDatabase(): Promise<void> {
  await sql`select 1`;
}
