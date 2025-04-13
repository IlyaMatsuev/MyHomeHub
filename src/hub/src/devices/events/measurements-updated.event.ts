export class DeviceMeasurementsUpdatedEvent {
    static eventName = 'device.measurements.updated';

    constructor(public readonly deviceExternalId: string) {}
}
