export class RateLimiter {
    private tokens: number;
    private readonly maxTokens: number;
    private readonly refillRatePerMs: number;
    private lastRefill: number;
    private queue: Array<() => void> = [];

    constructor(options: {
        requestsPerMinute?: number;
        burstAllowance?: number;
    } = {}) {
        const rpm = options.requestsPerMinute ?? 1;
        this.maxTokens = options.burstAllowance ?? Math.min(rpm, 5);
        this.tokens = this.maxTokens;
        this.refillRatePerMs = rpm / 60_000;
        this.lastRefill = Date.now();
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const newTokens = elapsed * this.refillRatePerMs;
        this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
        this.lastRefill = now;
    }


    async acquire(): Promise<number> {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return 0;
        }

        const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                this.refill();
                this.tokens = Math.max(0, this.tokens - 1);
                resolve();

                this.drainQueue();
            }, waitMs);
            this.queue.push(() => {
                clearTimeout(timer);
                resolve();
            });
        });

        return waitMs;
    }

    private drainQueue(): void {
        const next = this.queue.shift();
        if (next) next();
    }
}