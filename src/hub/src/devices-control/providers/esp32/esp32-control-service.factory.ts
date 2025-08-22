import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceType } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { Esp32ControlService } from 'devices-control/providers';
import { MqttService } from 'mqtt/mqtt.service';

@Injectable()
export class Esp32ControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        private readonly configService: ConfigService,
        private readonly mqttService: MqttService,
    ) {}

    eligible(device: Device): boolean {
        return device.type === DeviceType.ESP32;
    }

    createService(device: Device): Esp32ControlService {
        return new Esp32ControlService(device, this.configService, this.mqttService);
    }
}
