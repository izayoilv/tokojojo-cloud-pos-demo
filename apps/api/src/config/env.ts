export const APP_ENVS = ["development", "test", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface RuntimeEnv {
  appEnv: AppEnv;
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
}

export function resolveAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const value = (env.APP_ENV ?? env.NODE_ENV)?.trim();
  if (!value) {
    throw new Error(
      "APP_ENV or NODE_ENV is required and must be development, test, or production.",
    );
  }
  if (!(APP_ENVS as readonly string[]).includes(value)) {
    throw new Error(
      `APP_ENV must be development, test, or production; got ${value}.`,
    );
  }
  return value as AppEnv;
}

export function loadRuntimeEnv(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeEnv {
  const appEnv = resolveAppEnv(env);
  return {
    appEnv,
    isDevelopment: appEnv === "development",
    isTest: appEnv === "test",
    isProduction: appEnv === "production",
  };
}

export function requiresRuntimeSecrets(runtime: RuntimeEnv): boolean {
  return !runtime.isDevelopment;
}
