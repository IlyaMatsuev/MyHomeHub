export class DeviceControlsUpdatedEvent {
    static eventName = 'device.controls.updated';

    constructor(
        public readonly deviceExternalId: string,
        public readonly controls: Record<string, object>,
    ) {}
}
