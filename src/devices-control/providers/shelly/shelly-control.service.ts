import { ClassConstructor } from 'class-transformer/types/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { ShellyControlsDto } from 'devices-control/providers';
import { DeviceControls } from 'devices/interfaces';
import { TransportMessage } from 'devices-control/interfaces';

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

    protected async getControlsPayload<T extends DeviceControls>(controls: T): Promise<TransportMessage> {
        return {
            url: `http://${this.getDeviceIP()}/rpc`,
            method: 'POST',
            payload: {
                id: 1,
                method: ShellyMethod.SwitchSet,
                params: {
                    id: 0,
                    ...controls,
                },
            },
        };
    }
}
