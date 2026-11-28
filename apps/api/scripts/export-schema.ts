import { writeFileSync } from "node:fs";

import { printSchema } from "graphql";

import { appSchema } from "../src/graphql/schema.ts";

const outIndex = process.argv.indexOf("--out");
const output = `${printSchema(appSchema)}\n`;

if (outIndex !== -1) {
  const target = process.argv[outIndex + 1];
  if (!target) {
    console.error("schema:export: --out requires a file path");
    process.exit(1);
  }
  writeFileSync(target, output);
} else {
  process.stdout.write(output);
}
