import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { MqttService } from 'mqtt/mqtt.service';
import { PhilipsControlService } from './philips-control.service';

@Injectable()
export class PhilipsControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        private readonly configService: ConfigService,
        private readonly mqttService: MqttService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.Philips;
    }

    createService(device: Device): PhilipsControlService {
        return new PhilipsControlService(device, this.configService, this.mqttService);
    }
}
