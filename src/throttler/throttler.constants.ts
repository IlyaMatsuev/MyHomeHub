import { seconds } from '@nestjs/throttler';

export const THROTTLER_DEFINITIONS = ['short', 'medium', 'long'];

// Named strict-throttle profiles used by `@StrictThrottle('<profile>')`.
// The decorator overrides EVERY definition above with the same tight (limit, ttl)
// so we don't need to duplicate the values per tier or worry about which
// tier is registered via env.
export const STRICT_THROTTLE_PROFILES = {
    login: { limit: 5, ttl: seconds(15 * 60) },
    loginRefresh: { limit: 30, ttl: seconds(5 * 60) },
    register: { limit: 5, ttl: seconds(60 * 60) },
    passwordReset: { limit: 3, ttl: seconds(60 * 60) },
    passwordChange: { limit: 5, ttl: seconds(15 * 60) },
    registrationRequest: { limit: 10, ttl: seconds(10 * 60) },
} as const;

export type StrictThrottleProfile = keyof typeof STRICT_THROTTLE_PROFILES;
