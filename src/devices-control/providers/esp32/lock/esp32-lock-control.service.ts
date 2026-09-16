import { ClassConstructor } from 'class-transformer/types/interfaces';
import { Esp32ControlService } from '../esp32-control.service';
import { Esp32LockControlsDto } from './esp32-lock-controls.dto';

export class Esp32LockControlService extends Esp32ControlService {
    protected getServiceName(): string {
        return Esp32LockControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return Esp32LockControlsDto as ClassConstructor<T>;
    }
}
