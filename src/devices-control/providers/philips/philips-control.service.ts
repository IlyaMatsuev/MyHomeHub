import { DevicesControlService } from 'devices-control/devices-control.service';
import { PhilipsControlsDto } from './philips-controls.dto';
import type { ClassConstructor } from 'class-transformer';
import { TransportMessage } from 'devices-control/interfaces';

export class PhilipsControlService extends DevicesControlService {
    protected getServiceName(): string {
        return PhilipsControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return PhilipsControlsDto as ClassConstructor<T>;
    }

    protected async getControlsPayload(): Promise<TransportMessage> {
        // TODO: Implement for philips devices
        // TODO: Skip state set for remotes - they don't have states
        return null;
    }
}
