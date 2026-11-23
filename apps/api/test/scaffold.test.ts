import assert from "node:assert/strict";
import { after, test } from "node:test";

import { testSql } from "./db.ts";

after(() => testSql.end());

test("PostgreSQL 18 is reachable", async () => {
  const [row] =
    await testSql`select current_setting('server_version_num')::int as version`;
  assert.ok(row.version >= 180000, `expected PG 18+, got ${row.version}`);
});
