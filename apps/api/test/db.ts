import assert from "node:assert/strict";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Export it before running tests.");
}

export const testSql = postgres(databaseUrl, { max: 1 });

export function randomSuffix(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export async function expectReject(fn: () => Promise<unknown>): Promise<Error> {
  try {
    await fn();
  } catch (error) {
    return error as Error;
  }
  assert.fail("expected promise to reject");
}
