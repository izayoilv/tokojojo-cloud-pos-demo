export const MIN_ARGON2_CONCURRENCY = 2;
export const MAX_ARGON2_CONCURRENCY = 4;

/**
 * Small FIFO semaphore used to keep expensive Argon2 work within the 2–4
 * concurrent-operation budget from the security contract.
 */
export class Semaphore {
  readonly limit: number;
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(limit: number) {
    const normalized = Number.isFinite(limit) ? Math.trunc(limit) : 3;
    this.limit = Math.min(
      MAX_ARGON2_CONCURRENCY,
      Math.max(MIN_ARGON2_CONCURRENCY, normalized),
    );
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }
}

export function argon2ConcurrencyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env.ARGON2_CONCURRENCY ?? 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(
    MAX_ARGON2_CONCURRENCY,
    Math.max(MIN_ARGON2_CONCURRENCY, parsed),
  );
}

let defaultSemaphore: Semaphore | undefined;

export function getDefaultArgon2Semaphore(): Semaphore {
  defaultSemaphore ??= new Semaphore(argon2ConcurrencyFromEnv());
  return defaultSemaphore;
}
