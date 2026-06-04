export const DEVICE_MODEL_PROVIDER_NAME = 'DEVICE_MODEL';
export const DEVICE_SCHEMA_NAME = 'Device';

export const DEVICE_NAME_MIN_LENGTH = 3;
export const DEVICE_NAME_MAX_LENGTH = 40;
export const DEVICE_DEFAULT_UPDATE_INTERVAL = 0;
export const DEVICE_ALLOWED_IP_VERSION = 4;

export const MIN_PAIRING_TIMEOUT_SECONDS = 30;
export const MAX_PAIRING_TIMEOUT_SECONDS = 254;

export const ESP32_DEVICE_PAIR_REQUEST_TOPIC = 'home/devices/pair';
export const ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC = 'homeGET_ALL_DEVICES_PAGE_SIZE/devices/pair/reply';
export const ESP32_DEVICE_CONTROLS_UPDATE_TOPIC = 'home/devices/+/controls/update';
export const ESP32_DEVICE_CONTROLS_SYNC_TOPIC = 'home/devices/+/controls/sync';
export const ESP32_DEVICE_MEASUREMENTS_UPDATE_TOPIC = 'home/devices/+/measurements/update';

export const ESP32_DEVICE_MEASUREMENTS_DEFAULT_UPDATE_INTERVAL = 1000 * 60 * 5;
