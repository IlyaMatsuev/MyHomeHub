export const DEFAULT_SERVER_LABEL = 'SmartHome Hub';
export const DEFAULT_PORT = 3000;

export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 50;
export const MIN_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 5;

export const EXTERNAL_ID_UUID_VERSION = 4;

export const ZIGBEE_FRIENDLY_NAME_MIN_LENGTH = 3;
export const ZIGBEE_FRIENDLY_NAME_MAX_LENGTH = 60;
export const ZIGBEE_FRIENDLY_NAME_REGEX = /^\w(?:[\w ]*\w)?$/;
export const ZIGBEE_FRIENDLY_NAME_REGEX_ERROR_MESSAGE =
    'Zigbee friendly name can consist of English letters, digits, spaces, and underscores';
export const ZIGBEE_IEEE_ADDRESS_REGEX = /^0x[0-9a-fA-F]{16}$/;
export const ZIGBEE_IEEE_ADDRESS_REGEX_ERROR_MESSAGE = 'Zigbee IEEE address must match the format 0x followed by 16 hex characters';
