import { createServer } from "node:http";

import { loadEnvFile, rootEnvFile } from "./db/env.ts";

loadEnvFile(rootEnvFile);

const { createAuthServices } = await import("./auth/services.ts");
const { createApp } = await import("./app.ts");
const { checkDatabase } = await import("./db/health.ts");
const { sql } = await import("./db/client.ts");

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const auth = createAuthServices();
const app = createApp({ checkDatabase, authServices: auth });
const server = createServer(app);
const { startAuthCleanupJob } = await import("./auth/cleanup.ts");
const { startAuditRetentionJob } = await import("./audit/service.ts");
const stopAuditRetention = startAuditRetentionJob();
const stopAuthCleanup = startAuthCleanupJob();

server.listen(port, host, () => {
  console.log(`tokojojo-api listening on http://${host}:${port}`);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAuditRetention();
  stopAuthCleanup();
  auth.stop();

  console.log(`tokojojo-api received ${signal}, shutting down`);

  const forceExit = setTimeout(() => {
    console.error("tokojojo-api shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      console.error(`tokojojo-api server close failed: ${error.name}`);
    }

    try {
      await sql.end({ timeout: 5 });
    } catch (closeError) {
      console.error(
        `tokojojo-api database close failed: ${
          closeError instanceof Error ? closeError.name : "UnknownError"
        }`,
      );
    }

    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
