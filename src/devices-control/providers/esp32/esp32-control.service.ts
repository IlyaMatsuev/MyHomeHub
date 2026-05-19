import { ConfigService } from '@nestjs/config';
import { MqttService } from 'mqtt/mqtt.service';
import { CONTROLS_UPDATE_TOPIC_NAME } from 'mqtt/mqtt.constants';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { Device } from 'devices/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { Esp32ControlsDto } from 'devices-control/providers';

export class Esp32ControlService extends DevicesControlService {
    constructor(
        protected readonly device: Device,
        protected readonly configService: ConfigService,
        private readonly mqttService: MqttService,
    ) {
        super(device, configService);
    }

    protected getServiceName(): string {
        return Esp32ControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return Esp32ControlsDto as ClassConstructor<T>;
    }

    protected async setDeviceControls(controls: Esp32ControlsDto): Promise<void | never> {
        this.mqttService.publish(CONTROLS_UPDATE_TOPIC_NAME, controls, this.device.externalId);
    }
}
