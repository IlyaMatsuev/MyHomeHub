import { DevicePayload } from 'devices/interfaces';

/**
 * Removes the null/undefined fields from a payload before it is sent to a device.
 * Controls declared in a device config are initialized with "null" - remove them
 */
export function stripEmptyValues<T extends DevicePayload>(payload: T): T {
    if (!payload) {
        return payload;
    }
    return Object.entries(payload).reduce((result, [name, value]) => {
        if (value !== null && value !== undefined) {
            result[name] = value;
        }
        return result;
    }, {} as DevicePayload) as T;
}
