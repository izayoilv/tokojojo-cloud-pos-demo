import { createPasetoService, type PasetoService } from "./paseto.ts";
import type { PepperConfig } from "./passwords.ts";
import { loadPepperConfigFromEnv } from "./passwords.ts";
import {
  LoginRateLimiter,
  loginRateLimitFromEnv,
  type LoginRateLimitOptions,
} from "./rate-limit.ts";
import { getDefaultArgon2Semaphore, type Semaphore } from "./semaphore.ts";
import { SESSION_TTL_MS } from "./tokens.ts";

const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export interface AuthServiceOptions {
  peppers?: PepperConfig;
  rateLimit?: Partial<LoginRateLimitOptions>;
  refreshRateLimit?: Partial<LoginRateLimitOptions>;
  nonceRateLimit?: Partial<LoginRateLimitOptions>;
  upgradeRateLimit?: Partial<LoginRateLimitOptions>;
  syncRateLimit?: Partial<LoginRateLimitOptions>;
  sessionTtlMs?: number;
  refreshTtlMs?: number;
  argon2?: Semaphore;
  paseto?: PasetoService;
  now?: () => Date;
}

export interface AuthServices {
  peppers: PepperConfig;
  rateLimit: LoginRateLimiter;
  refreshRateLimit: LoginRateLimiter;
  nonceRateLimit: LoginRateLimiter;
  upgradeRateLimit: LoginRateLimiter;
  syncRateLimit: LoginRateLimiter;
  sessionTtlMs: number;
  refreshTtlMs: number;
  argon2: Semaphore;
  paseto: PasetoService;
  now: () => Date;
}

function positiveDuration(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sessionTtlFromEnv(env: NodeJS.ProcessEnv): number {
  return positiveDuration(env.AUTH_SESSION_TTL_MS, SESSION_TTL_MS);
}

export function createAuthServices(
  options: AuthServiceOptions = {},
): AuthServices {
  const now = options.now ?? (() => new Date());
  const peppers = options.peppers ?? loadPepperConfigFromEnv();
  const rateLimit = new LoginRateLimiter(
    {
      ...loginRateLimitFromEnv(),
      ...options.rateLimit,
    },
    () => now().getTime(),
  );
  const refreshRateLimit = new LoginRateLimiter(
    {
      perIp: 60,
      perUsername: 30,
      windowMs: 15 * 60 * 1000,
      ...options.refreshRateLimit,
    },
    () => now().getTime(),
  );
  const nonceRateLimit = new LoginRateLimiter(
    {
      perIp: 60,
      perUsername: 30,
      windowMs: 60 * 1000,
      ...options.nonceRateLimit,
    },
    () => now().getTime(),
  );
  const upgradeRateLimit = new LoginRateLimiter(
    {
      perIp: 30,
      perUsername: 10,
      windowMs: 15 * 60 * 1000,
      ...options.upgradeRateLimit,
    },
    () => now().getTime(),
  );
  const syncRateLimit = new LoginRateLimiter(
    {
      perIp: 60,
      perUsername: 30,
      windowMs: 60 * 1000,
      ...options.syncRateLimit,
    },
    () => now().getTime(),
  );

  return {
    peppers,
    rateLimit,
    refreshRateLimit,
    nonceRateLimit,
    upgradeRateLimit,
    syncRateLimit,
    sessionTtlMs: options.sessionTtlMs ?? sessionTtlFromEnv(process.env),
    refreshTtlMs:
      options.refreshTtlMs ??
      positiveDuration(process.env.AUTH_REFRESH_TTL_MS, REFRESH_TTL_MS),
    argon2: options.argon2 ?? getDefaultArgon2Semaphore(),
    paseto: options.paseto ?? createPasetoService(),
    now,
  };
}
