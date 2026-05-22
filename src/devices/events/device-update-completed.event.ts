export class DeviceUpdateCompletedEvent {
    static readonly eventName = 'device.update.completed';

    constructor(
        readonly deviceExternalId: string,
        readonly controlsUpdated: boolean = true,
        readonly measurementsUpdated: boolean = true,
    ) {}
}
