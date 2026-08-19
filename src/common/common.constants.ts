export const DEFAULT_SERVER_LABEL = 'My Home Hub';
export const DEFAULT_PORT = 3000;

export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 50;
export const MIN_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 5;

export const EXTERNAL_ID_UUID_VERSION = '4';

export const ZIGBEE_FRIENDLY_NAME_MIN_LENGTH = 3;
export const ZIGBEE_FRIENDLY_NAME_MAX_LENGTH = 60;
export const ZIGBEE_FRIENDLY_NAME_REGEX = /^\w(?:[\w ]*\w)?$/;
export const ZIGBEE_FRIENDLY_NAME_REGEX_ERROR_MESSAGE =
    'Zigbee friendly name can consist of English letters, digits, spaces, and underscores';
export const ZIGBEE_IEEE_ADDRESS_REGEX = /^0x[0-9a-fA-F]{16}$/;
export const ZIGBEE_IEEE_ADDRESS_REGEX_ERROR_MESSAGE = 'Zigbee IEEE address must match the format 0x followed by 16 hex characters';

// ipaddr.js range names that are considered part of the local network:
// IPv4 loopback (127.0.0.0/8), private (10/8, 172.16/12, 192.168/16) and link-local (169.254/16),
// IPv6 loopback (::1), unique local (fc00::/7) and link-local (fe80::/10)
export const LOCAL_IP_RANGES = ['loopback', 'private', 'linkLocal', 'uniqueLocal'];

export const IPV4_PREFIX_LENGTH = 32;
export const IPV6_PREFIX_LENGTH = 128;
