import { request } from 'gaxios';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { ShellyControlsDto } from 'devices-control/providers';

enum ShellyMethod {
    SwitchSet = 'Switch.Set',
}

export class ShellyControlService extends DevicesControlService {
    protected getServiceName(): string {
        return ShellyControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return ShellyControlsDto as ClassConstructor<T>;
    }

    protected async setDeviceControls<T>(controls: ShellyControlsDto): Promise<T> {
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
