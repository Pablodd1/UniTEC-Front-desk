import { describe, it, expect } from 'vitest';

function createLimiter(limit: number, windowMs: number) {
  const rateMap = new Map<string, number[]>();
  return function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = (rateMap.get(ip) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= limit) return true;
    timestamps.push(now);
    rateMap.set(ip, timestamps);
    return false;
  };
}

describe('Serverless IP Rate Limiter', () => {
  it('should allow requests under the limit', () => {
    const limiter = createLimiter(5, 60000);
    const ip = '192.168.1.100';
    for (let i = 0; i < 5; i++) {
      expect(limiter(ip)).toBe(false);
    }
  });

  it('should block requests that exceed the limit', () => {
    const limiter = createLimiter(3, 60000);
    const ip = '10.0.0.1';
    expect(limiter(ip)).toBe(false);
    expect(limiter(ip)).toBe(false);
    expect(limiter(ip)).toBe(false);
    expect(limiter(ip)).toBe(true); // 4th request blocked
  });
});
