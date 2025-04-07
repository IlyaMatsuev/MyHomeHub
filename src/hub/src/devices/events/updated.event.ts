import { UpdateDeviceDto } from 'devices/dto';

export class DeviceUpdatedEvent {
    static eventName = 'device.updated';

    constructor(
        public readonly deviceExternalId: string,
        public readonly update: UpdateDeviceDto,
    ) {}
}
