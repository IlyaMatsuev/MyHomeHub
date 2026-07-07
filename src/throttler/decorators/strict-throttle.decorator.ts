import { Throttle } from '@nestjs/throttler';
import { STRICT_THROTTLE_PROFILES, StrictThrottleProfile, THROTTLER_DEFINITIONS } from 'throttler/throttler.constants';

// Overrides every registered throttler tier with the selected profile's
// (ttl, limit), so a decorated endpoint gets the tightest bucket regardless of
// which tiers are enabled via THROTTLE_* env vars.
export const StrictThrottle = (profile: StrictThrottleProfile): MethodDecorator & ClassDecorator => {
    const { limit, ttl } = STRICT_THROTTLE_PROFILES[profile];
    const override = Object.fromEntries(THROTTLER_DEFINITIONS.map(name => [name, { limit, ttl }]));
    return Throttle(override);
};
