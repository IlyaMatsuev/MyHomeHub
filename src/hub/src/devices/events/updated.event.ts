import { UpdateDeviceDto } from 'devices/dto';

export class DeviceUpdatedEvent {
    static eventName = 'device.updated';

    constructor(
        public readonly deviceExternalId: string,
        public readonly update: UpdateDeviceDto,
    ) {}

    get controlsUpdated(): boolean {
        return !!Object.keys(this.update.controls ?? {}).length;
    }

    get measurementsUpdated(): boolean {
        return !!Object.keys(this.update.measurements ?? {}).length;
    }
}
