import { ClassConstructor } from 'class-transformer/types/interfaces';
import { Esp32FansControlsDto } from 'devices-control/providers/esp32/fans';
import { Esp32ControlService } from '../esp32-control.service';

export class Esp32FansControlService extends Esp32ControlService {
    protected getServiceName(): string {
        return Esp32FansControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return Esp32FansControlsDto as ClassConstructor<T>;
    }
}
