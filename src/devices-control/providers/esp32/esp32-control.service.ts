import { ClassConstructor } from 'class-transformer/types/interfaces';
import { ESP32_DEVICE_CONTROLS_UPDATE_TOPIC } from 'devices/devices.constants';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { Esp32ControlsDto } from 'devices-control/providers';
import { TransportMessage } from 'devices-control/interfaces';

export class Esp32ControlService extends DevicesControlService {
    protected getServiceName(): string {
        return Esp32ControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return Esp32ControlsDto as ClassConstructor<T>;
    }

    protected async getControlsPayload(controls: Esp32ControlsDto): Promise<TransportMessage> {
        return {
            topic: ESP32_DEVICE_CONTROLS_UPDATE_TOPIC,
            topicParams: [this.device.externalId],
            payload: controls,
        };
    }
}
