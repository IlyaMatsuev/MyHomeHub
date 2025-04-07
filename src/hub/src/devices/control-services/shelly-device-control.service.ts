import { DeviceControlService } from 'devices/control-services/device-control.service';
import { Device } from 'devices/interfaces';
import { request } from 'gaxios';

enum ShellyMethod {
    SwitchSet = 'Switch.Set',
}

export class ShellyDeviceControlService extends DeviceControlService {
    constructor(protected readonly device: Device) {
        super(device, ShellyDeviceControlService.name);
    }

    async setControls<T>(controls: Record<string, unknown>): Promise<T> {
        if (!this.device.deviceAddress) {
            throw new Error(
                `The shelly device with id "${this.device.externalId}" does not have an address, not possible to set the controls`,
            );
        }
        const response = await request<T>({
            url: `${this.device.deviceAddress}/rpc`,
            method: 'POST',
            headers: {},
            data: {
                id: 1,
                method: ShellyMethod.SwitchSet,
                params: {
                    id: 0,
                    ...controls,
                },
            },
        });
        return response.data;
    }
}
