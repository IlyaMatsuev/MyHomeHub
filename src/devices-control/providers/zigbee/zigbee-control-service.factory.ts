import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { MqttService } from 'mqtt/mqtt.service';
import { ZigbeeControlService } from './zigbee-control.service';

@Injectable()
export class ZigbeeControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        private readonly configService: ConfigService,
        private readonly mqttService: MqttService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.Zigbee;
    }

    createService(device: Device): ZigbeeControlService {
        return new ZigbeeControlService(device, this.configService, this.mqttService);
    }
}
