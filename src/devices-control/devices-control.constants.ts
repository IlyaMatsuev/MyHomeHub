export const DEVICES_CONTROL_FACTORY_PROVIDER = 'DEVICES_CONTROL_FACTORY';
export const DEVICE_TRANSPORT_FACTORY_PROVIDER = 'DEVICE_TRANSPORT_PROVIDER';

// Devices are read over the local network while an API caller is waiting for the response,
// so a request hanging longer than this is not worth blocking the response for
export const DEVICE_STATE_READ_TIMEOUT_MS = 5000;

export const TUYA_DEVICE_MIN_BRIGHTNESS = 1;
export const TUYA_DEVICE_MAX_BRIGHTNESS = 100;
