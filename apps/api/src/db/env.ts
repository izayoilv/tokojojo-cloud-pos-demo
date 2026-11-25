import { fileURLToPath } from "node:url";

export const rootEnvFile = fileURLToPath(
  new URL("../../../../.env", import.meta.url),
);

export function loadEnvFile(path: string): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
