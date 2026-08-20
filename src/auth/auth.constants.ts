export const PASSWORD_RESET_REDIS_CLIENT = 'PASSWORD_RESET_REDIS_CLIENT';
export const PASSWORD_RESET_TOKEN_REDIS_KEY_PREFIX = 'pwreset';
export const PASSWORD_RESET_TOKEN_BYTES = 32;

// ipaddr.js range names that are considered part of the local network:
// IPv4 loopback (127.0.0.0/8), private (10/8, 172.16/12, 192.168/16) and link-local (169.254/16),
// IPv6 loopback (::1), unique local (fc00::/7) and link-local (fe80::/10)
export const LOCAL_IP_RANGES = ['loopback', 'private', 'linkLocal', 'uniqueLocal'];
