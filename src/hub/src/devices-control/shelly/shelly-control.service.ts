import { DevicesControlService } from 'devices-control/devices-control.service';
import { request } from 'gaxios';

enum ShellyMethod {
    SwitchSet = 'Switch.Set',
}

export class ShellyControlService extends DevicesControlService {
    protected getServiceName(): string {
        return ShellyControlService.name;
    }

    protected async setDeviceControls<T>(controls: Record<string, unknown>): Promise<T> {
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
