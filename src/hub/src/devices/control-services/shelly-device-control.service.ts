import { BaseDeviceControlService } from 'devices/control-services/base-device-control.service';
import { Device } from 'devices/interfaces';

enum ShellyMethod {
    SwitchSet = 'Switch.Set',
}

export class ShellyDeviceControlService extends BaseDeviceControlService {
    constructor(protected readonly device: Device) {
        super(device);
    }

    protected getSetControlsPayload(controls: Record<string, object>): string | Record<string, unknown> {
        return {
            id: 1,
            method: ShellyMethod.SwitchSet,
            params: {
                id: 0,
                ...controls,
            },
        };
    }

    protected getEndpoint(): string {
        return `${this.device.deviceAddress}/rpc`;
    }
}
