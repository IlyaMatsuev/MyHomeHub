import { DEVICE_PAYLOAD_OVERRIDE_KEY } from 'devices/devices.constants';

export interface DevicePayload {
    [DEVICE_PAYLOAD_OVERRIDE_KEY]?: boolean;
    [key: string]: unknown;
}

export interface DeviceControls extends DevicePayload {
    on?: boolean;
}
