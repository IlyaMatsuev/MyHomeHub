import { ClassConstructor } from 'class-transformer/types/interfaces';
import { ShellyLedControlsDto } from 'devices-control/providers/shelly/led';
import { ShellyComponent } from '../shelly.constants';
import { ShellyControlService } from '../shelly-control.service';

export class ShellyLedControlService extends ShellyControlService {
    protected getServiceName(): string {
        return ShellyLedControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return ShellyLedControlsDto as ClassConstructor<T>;
    }

    protected getComponents(): ReadonlyArray<ShellyComponent> {
        return [ShellyComponent.RGBCCT];
    }
}
