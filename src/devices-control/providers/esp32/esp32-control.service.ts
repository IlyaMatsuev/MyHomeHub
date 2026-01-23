import { ConfigService } from '@nestjs/config';
import { MqttService } from 'mqtt/mqtt.service';
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
        await this.mqttService.updateDeviceControls(this.device.externalId, controls);
    }
}
