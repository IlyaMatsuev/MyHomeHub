import { ParsedDeviceConfig } from 'device-configs/interfaces';

export class DeviceConfigsChangedEvent {
    static readonly eventName = 'device.configs.changed';

    constructor(readonly configs: Array<ParsedDeviceConfig>) {}
}
