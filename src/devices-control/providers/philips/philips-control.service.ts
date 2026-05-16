import { ConfigService } from '@nestjs/config';
import { MqttService } from 'mqtt/mqtt.service';
import { ClassConstructor } from 'class-transformer/types/interfaces';
import { Device } from 'devices/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { PhilipsControlsDto } from './philips-controls.dto';

export class PhilipsControlService extends DevicesControlService {
    constructor(
        protected readonly device: Device,
        protected readonly configService: ConfigService,
        private readonly mqttService: MqttService,
    ) {
        super(device, configService);
    }

    protected getServiceName(): string {
        return PhilipsControlService.name;
    }

    protected getControlsDtoType<T extends object>(): ClassConstructor<T> {
        return PhilipsControlsDto as ClassConstructor<T>;
    }

    protected async setDeviceControls(controls: PhilipsControlsDto): Promise<void | never> {
        const friendlyName = this.device.zigbeeFriendlyName;
        if (!friendlyName) {
            throw new Error(`The device with id "${this.device.externalId}" does not have a Zigbee friendly name`);
        }

        const payload = this.mapControlsToZ2MPayload(controls);
        await this.mqttService.publishZigbeeCommand(friendlyName, payload);
    }

    private mapControlsToZ2MPayload(controls: PhilipsControlsDto): Record<string, unknown> {
        const payload: Record<string, unknown> = {};

        if (controls.on !== undefined) {
            payload.state = controls.on ? 'ON' : 'OFF';
        }

        if (controls.brightness !== undefined) {
            payload.brightness = Math.round((controls.brightness / 100) * 254);
        }

        if (controls.color !== undefined) {
            payload.color = { hex: controls.color };
        }

        if (controls.colorTemp !== undefined) {
            // eslint-disable-next-line camelcase
            payload.color_temp = controls.colorTemp;
        }

        return payload;
    }
}
