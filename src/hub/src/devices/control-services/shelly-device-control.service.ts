import { DeviceControlService } from 'devices/control-services';
import { request } from 'gaxios';

enum ShellyMethod {
    SwitchSet = 'Switch.Set',
}

export class ShellyDeviceControlService extends DeviceControlService {
    protected getServiceName(): string {
        return ShellyDeviceControlService.name;
    }

    async setControls<T>(controls: Record<string, unknown>): Promise<T> {
        const response = await request<T>({
            url: `http://${this.getDeviceIP()}/rpc`,
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
