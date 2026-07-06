import { Throttle, seconds } from '@nestjs/throttler';
import { THROTTLER_DEFINITIONS } from 'throttler/throttler.constants';

// Overrides every registered throttler tier with the same strict (ttl, limit)
// pair, so sensitive endpoints get the tightest of the tiers regardless of
// which are enabled via THROTTLE_* env vars.
export const StrictThrottle = (limit: number, ttlSeconds: number): MethodDecorator & ClassDecorator => {
    const ttl = seconds(ttlSeconds);
    const override = Object.fromEntries(THROTTLER_DEFINITIONS.map(name => [name, { limit, ttl }]));
    return Throttle(override);
};
