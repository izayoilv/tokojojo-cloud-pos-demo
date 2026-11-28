import assert from "node:assert/strict";
import { after, test } from "node:test";

import postgres from "postgres";

import { listAuditEvents } from "../src/audit/service.ts";
import { randomSuffix, testSql } from "./db.ts";

const sharedSql = await import("../src/db/client.ts").then(
  (module) => module.sql,
);

after(async () => {
  await Promise.all([testSql.end(), sharedSql.end({ timeout: 5 })]);
});

test("audit listing batches actor/device hydration", async () => {
  const suffix = randomSuffix();
  const eventType = `AUDIT_N1_${suffix}`;
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (
      ${`Audit N1 ${suffix}`}, ${`audit-n1-${suffix}`}, 'x', 'OWNER'
    )
    returning id`;
  const [device] = await testSql`
    insert into devices (
      name, platform, enrolled_by_user_id, status, enrolled_at
    )
    values (
      ${`Audit device ${suffix}`}, 'ANDROID', ${user.id}, 'ACTIVE', now()
    )
    returning id`;
  await testSql`
    insert into audit_events (
      event_type, actor_user_id, device_id, metadata, retention_until
    )
    select
      ${eventType}, ${user.id}, ${device.id}, '{}'::jsonb,
      now() + interval '180 days'
    from generate_series(1, 100)`;

  let queryCount = 0;
  const countedSql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    debug: () => {
      queryCount += 1;
    },
  });
  try {
    const page = await listAuditEvents(
      {
        filter: { eventType },
        page: { page: 1, pageSize: 100 },
      },
      countedSql,
    );
    assert.equal(page.items.length, 100);
    assert.equal(page.items[0]?.actor?.id, user.id);
    assert.equal(page.items[0]?.device?.id, device.id);
    assert.equal(page.items[0]?.device?.enrolledBy.id, user.id);
    assert.ok(queryCount > 0, "queries were counted");
    assert.ok(
      queryCount <= 6,
      `expected a constant query count, got ${queryCount}`,
    );

    queryCount = 0;
    const one = await listAuditEvents(
      {
        filter: { eventType },
        page: { page: 1, pageSize: 1 },
      },
      countedSql,
    );
    assert.equal(one.items.length, 1);
    assert.ok(
      queryCount <= 6,
      `page size 1 should use the same constant count, got ${queryCount}`,
    );
  } finally {
    await countedSql.end({ timeout: 5 });
  }
});
