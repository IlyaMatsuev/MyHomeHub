import { UpdateDeviceDto } from 'devices/dto';

type DeviceIdKeys = 'externalId' | 'ip' | 'zigbeeFriendlyName';

export type UpdatedDeviceSelector = {
    [K in DeviceIdKeys]: Record<K, string>;
}[DeviceIdKeys];

export class DeviceUpdateRequestedEvent {
    static readonly eventName = 'device.update.requested';

    constructor(
        readonly selector: UpdatedDeviceSelector,
        readonly update: UpdateDeviceDto,
        // Set to "false" to prevent sending a device update state back to the device (repeated device state update)
        readonly propagate: boolean = true,
    ) {}
}
