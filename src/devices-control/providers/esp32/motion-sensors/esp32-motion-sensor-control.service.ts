import { ClassConstructor } from 'class-transformer/types/interfaces';
import { Esp32MotionSensorsControlsDto } from 'devices-control/providers/esp32/motion-sensors';
import { Esp32ControlService } from '../esp32-control.service';

export class Esp32MotionSensorControlService extends Esp32ControlService {
    protected getServiceName(): string {
        return Esp32MotionSensorControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return Esp32MotionSensorsControlsDto as ClassConstructor<T>;
    }
}
