import { DeviceBrand } from 'devices/interfaces';
import { TransportProtocol } from 'devices-control/interfaces';
import { CallbackWithoutResultAndOptionalError } from 'mongoose';

// Cannot cast the mongoose document type to the Device interface
export type ScopedDevice = { brand?: string; transportProtocol?: string };

// Fields that only make sense for a certain brand/protocol
const SCOPED_FIELDS: Array<[string, (device: ScopedDevice) => boolean]> = [
    ['tuyaDeviceId', isTuyaDevice],
    ['tuyaDeviceLocalKey', isTuyaDevice],
    ['zigbeeIeeeAddress', isZigbeeDevice],
    ['zigbeeFriendlyName', isZigbeeDevice],
];

export function isTuyaDevice(device: ScopedDevice): boolean {
    return device.brand === DeviceBrand.Tuya;
}

export function isZigbeeDevice(device: ScopedDevice): boolean {
    return device.transportProtocol === TransportProtocol.Zigbee;
}

/**
 * A device reassigned to another brand/protocol keeps all other unupdated fields.
 * These fields then can fail validators. For example, `tuya` => `zigbee` update can fail because the currently assigned tuyaLocalId is not valid for `zigbee` type
 * Such leftovers are removed here, unless written explicitly (isDirectModified)
 */
export function dropScopedDependencyFields(next: CallbackWithoutResultAndOptionalError) {
    for (const [field, isApplied] of SCOPED_FIELDS) {
        if (this[field] !== undefined && !isApplied(this) && !this.isDirectModified(field)) {
            this[field] = undefined;
        }
    }
    next();
}
