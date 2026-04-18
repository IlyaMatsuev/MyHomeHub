import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand, DeviceType } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { Esp32ControlService } from 'devices-control/providers';
import { MqttService } from 'mqtt/mqtt.service';
import { Esp32FansControlService } from 'devices-control/providers/esp32/fans';
import { Esp32MotionSensorsControlService } from 'devices-control/providers/esp32/motion-sensors';

@Injectable()
export class Esp32ControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        private readonly configService: ConfigService,
        private readonly mqttService: MqttService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.ESP32;
    }

    createService(device: Device): Esp32ControlService {
        if (device.type === DeviceType.Fans) {
            return new Esp32FansControlService(device, this.configService, this.mqttService);
        }
        if (device.type === DeviceType.MotionSensor) {
            return new Esp32MotionSensorsControlService(device, this.configService, this.mqttService);
        }
        return new Esp32ControlService(device, this.configService, this.mqttService);
    }
}
