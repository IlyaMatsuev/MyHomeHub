import { DevicePayload } from 'devices/interfaces';

export class DeviceCommandExecutedEvent {
    static readonly eventName = 'device.command.executed';

    constructor(
        readonly deviceExternalId: string,
        readonly command: DevicePayload,
    ) {}
}
