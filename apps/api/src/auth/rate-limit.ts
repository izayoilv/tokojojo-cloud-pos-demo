export interface LoginRateLimitOptions {
  perIp: number;
  perUsername: number;
  windowMs: number;
  /** Hard bound on live bucket keys. Oldest/LRU keys are evicted. */
  maxKeys?: number;
  /** How often expired buckets are swept. */
  sweepIntervalMs?: number;
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_KEYS = 10_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000;

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
    maxKeys: positiveInteger(env.AUTH_RATE_LIMIT_MAX_KEYS, DEFAULT_MAX_KEYS),
    sweepIntervalMs: positiveInteger(
      env.AUTH_RATE_LIMIT_SWEEP_MS,
      DEFAULT_SWEEP_INTERVAL_MS,
    ),
  };
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-process fixed-window limiter with a bounded LRU store and expiry sweep.
 * The API runs as one process in this phase; a shared store can replace this
 * without changing the auth service contract.
 */
export class LoginRateLimiter {
  readonly options: LoginRateLimitOptions;
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;
  private readonly maxKeys: number;
  private readonly sweepTimer: ReturnType<typeof setInterval>;

  constructor(options: LoginRateLimitOptions, now: () => number = Date.now) {
    this.options = options;
    this.now = now;
    this.maxKeys =
      Number.isInteger(options.maxKeys) && (options.maxKeys ?? 0) > 0
        ? options.maxKeys!
        : DEFAULT_MAX_KEYS;
    const sweepIntervalMs =
      Number.isInteger(options.sweepIntervalMs) &&
      (options.sweepIntervalMs ?? 0) > 0
        ? options.sweepIntervalMs!
        : DEFAULT_SWEEP_INTERVAL_MS;
    this.sweepTimer = setInterval(() => this.sweepExpired(), sweepIntervalMs);
    this.sweepTimer.unref();
  }

  get size(): number {
    return this.buckets.size;
  }

  check(ip: string, username: string): boolean {
    return (
      this.checkIp(ip) &&
      this.count(this.usernameKey(username)) < this.options.perUsername
    );
  }

  recordFailure(ip: string, username: string): void {
    this.increment(this.ipKey(ip));
    this.increment(this.usernameKey(username));
  }

  checkIp(ip: string): boolean {
    return this.count(this.ipKey(ip)) < this.options.perIp;
  }

  recordIpFailure(ip: string): void {
    this.increment(this.ipKey(ip));
  }

  /** Check a device bucket after the device proof/lookup has been verified. */
  checkDevice(deviceId: string): boolean {
    return this.count(this.deviceKey(deviceId)) < this.options.perUsername;
  }

  /** Record a device bucket after the device proof/lookup has been verified. */
  recordDeviceFailure(deviceId: string): void {
    this.increment(this.deviceKey(deviceId));
  }

  resetDevice(deviceId: string): void {
    this.buckets.delete(this.deviceKey(deviceId));
  }

  resetIp(ip: string): void {
    this.buckets.delete(this.ipKey(ip));
  }

  reset(ip: string, username: string): void {
    this.buckets.delete(this.ipKey(ip));
    this.buckets.delete(this.usernameKey(username));
  }

  sweepExpired(): void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }

  stop(): void {
    clearInterval(this.sweepTimer);
  }

  private ipKey(ip: string): string {
    return `ip:${ip}`;
  }

  private usernameKey(username: string): string {
    return `username:${username.toLocaleLowerCase("en-US")}`;
  }

  private deviceKey(deviceId: string): string {
    return `device:${deviceId}`;
  }

  private currentBucket(key: string): Bucket | undefined {
    const bucket = this.buckets.get(key);
    if (!bucket) return undefined;
    if (this.now() >= bucket.resetAt) {
      this.buckets.delete(key);
      return undefined;
    }
    // Refresh insertion order so eviction is least-recently-used.
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
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

    this.makeRoom();
    this.buckets.set(key, {
      count: 1,
      resetAt: this.now() + this.options.windowMs,
    });
  }

  private makeRoom(): void {
    if (this.buckets.size < this.maxKeys) return;
    this.sweepExpired();
    while (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next().value as string | undefined;
      if (!oldest) return;
      this.buckets.delete(oldest);
    }
  }
}
