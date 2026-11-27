export interface LoginRateLimitOptions {
  perIp: number;
  perUsername: number;
  windowMs: number;
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loginRateLimitFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LoginRateLimitOptions {
  return {
    perIp: positiveInteger(env.AUTH_LOGIN_RATE_LIMIT_IP, 20),
    perUsername: positiveInteger(env.AUTH_LOGIN_RATE_LIMIT_USERNAME, 5),
    windowMs: positiveInteger(env.AUTH_LOGIN_RATE_WINDOW_MS, DEFAULT_WINDOW_MS),
  };
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-process fixed-window limiter. The API runs as one process in this phase;
 * a shared store can replace this without changing the auth service contract.
 */
export class LoginRateLimiter {
  readonly options: LoginRateLimitOptions;
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;

  constructor(options: LoginRateLimitOptions, now: () => number = Date.now) {
    this.options = options;
    this.now = now;
  }

  check(ip: string, username: string): boolean {
    return (
      this.count(`ip:${ip}`) < this.options.perIp &&
      this.count(`username:${username.toLocaleLowerCase("en-US")}`) <
        this.options.perUsername
    );
  }

  recordFailure(ip: string, username: string): void {
    this.increment(`ip:${ip}`);
    this.increment(`username:${username.toLocaleLowerCase("en-US")}`);
  }

  reset(ip: string, username: string): void {
    this.buckets.delete(`ip:${ip}`);
    this.buckets.delete(`username:${username.toLocaleLowerCase("en-US")}`);
  }

  private currentBucket(key: string): Bucket | undefined {
    const bucket = this.buckets.get(key);
    if (!bucket) return undefined;
    if (this.now() >= bucket.resetAt) {
      this.buckets.delete(key);
      return undefined;
    }
    return bucket;
  }

  private count(key: string): number {
    return this.currentBucket(key)?.count ?? 0;
  }

  private increment(key: string): void {
    const bucket = this.currentBucket(key);
    if (bucket) {
      bucket.count += 1;
      return;
    }

    this.buckets.set(key, {
      count: 1,
      resetAt: this.now() + this.options.windowMs,
    });
  }
}
