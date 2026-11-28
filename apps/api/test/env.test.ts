import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { createApp } from "../src/app.ts";
import { createAuthServices } from "../src/auth/services.ts";
import { loadRuntimeEnv } from "../src/config/env.ts";
import { loadEnvFile, rootEnvFile } from "../src/db/env.ts";

const originalDatabaseUrl = process.env.DATABASE_URL;
const tempDirs: string[] = [];

after(async () => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempEnvFile(contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "tokojojo-env-"));
  tempDirs.push(dir);
  const file = path.join(dir, ".env");
  await writeFile(file, contents);
  return file;
}

test("root env path resolves to the repo-root .env", () => {
  const repoRoot = path.dirname(rootEnvFile);
  const pkg = JSON.parse(
    readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  );
  assert.equal(pkg.name, "tokojojo-cloud-pos-demo");
  assert.equal(path.basename(rootEnvFile), ".env");
  assert.equal(
    existsSync(path.join(repoRoot, "apps", "api", "package.json")),
    true,
  );
});

test("loads DATABASE_URL from a file without a shell export", async () => {
  const file = await tempEnvFile("DATABASE_URL=postgresql://from-file/db\n");
  delete process.env.DATABASE_URL;

  loadEnvFile(file);

  assert.equal(process.env.DATABASE_URL, "postgresql://from-file/db");
});

test("shell-exported DATABASE_URL wins over the file", async () => {
  const file = await tempEnvFile("DATABASE_URL=postgresql://from-file/db\n");
  process.env.DATABASE_URL = "postgresql://from-shell/db";

  loadEnvFile(file);

  assert.equal(process.env.DATABASE_URL, "postgresql://from-shell/db");
});

test("a missing env file is ignored", () => {
  const missing = path.join(tmpdir(), "tokojojo-missing-env", ".env");
  assert.doesNotThrow(() => loadEnvFile(missing));
});

test("runtime environment is explicit and validated", () => {
  assert.throws(() => loadRuntimeEnv({}), /APP_ENV or NODE_ENV/);
  assert.throws(
    () => loadRuntimeEnv({ APP_ENV: "staging" }),
    /development, test, or production/,
  );
  assert.equal(
    loadRuntimeEnv({ APP_ENV: "development" }).appEnv,
    "development",
  );
  assert.equal(loadRuntimeEnv({ NODE_ENV: "test" }).appEnv, "test");
  assert.throws(
    () => createApp({ checkDatabase: async () => {}, nodeEnv: "staging" }),
    /development, test, or production/,
  );
});

test("production refuses missing PASETO keys or pepper", () => {
  assert.throws(
    () =>
      createAuthServices({
        env: {
          APP_ENV: "production",
          PASSWORD_PEPPER_VERSION: "1",
        },
      }),
    /PASSWORD_PEPPER/,
  );
  assert.throws(
    () =>
      createAuthServices({
        env: {
          APP_ENV: "production",
          PASSWORD_PEPPER: "production-pepper",
          PASSWORD_PEPPER_VERSION: "1",
        },
      }),
    /PASETO_ACTIVE_PRIVATE_KEY/,
  );
  const testAuth = createAuthServices({
    env: {
      APP_ENV: "test",
      PASSWORD_PEPPER: "test-pepper",
      PASSWORD_PEPPER_VERSION: "1",
      PASETO_ACTIVE_KID: "test",
      PASETO_ACTIVE_PRIVATE_KEY: process.env.PASETO_ACTIVE_PRIVATE_KEY,
      PASETO_ACTIVE_PUBLIC_KEY: process.env.PASETO_ACTIVE_PUBLIC_KEY,
    },
  });
  testAuth.stop();
});
