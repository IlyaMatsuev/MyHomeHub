import { UpdateDeviceDto } from 'devices/dto';

type DeviceIdKeys = 'externalId' | 'ip' | 'zigbeeFriendlyName';

export type UpdatedDeviceSelector = {
    [K in DeviceIdKeys]: Record<K, string>;
}[DeviceIdKeys];

// TODO: Use this event from MQTT and Zigbee services
export class DeviceUpdatedEvent {
    static readonly eventName = 'device.updated';

    constructor(
        readonly selector: UpdatedDeviceSelector,
        readonly update: UpdateDeviceDto,
    ) {}
}
