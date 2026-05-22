import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand, DeviceType } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { Esp32ControlService } from 'devices-control/providers';
import { Esp32FansControlService } from 'devices-control/providers/esp32/fans';
import { Esp32MotionSensorControlService } from 'devices-control/providers/esp32/motion-sensors';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { DEVICE_TRANSPORT_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';

@Injectable()
export class Esp32ControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        @Inject(DEVICE_TRANSPORT_FACTORY_PROVIDER)
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        private readonly configService: ConfigService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.ESP32;
    }

    createService(device: Device): Esp32ControlService {
        if (device.type === DeviceType.Fans) {
            return new Esp32FansControlService(device, this.transportServiceResolver, this.configService);
        }
        if (device.type === DeviceType.MotionSensor) {
            return new Esp32MotionSensorControlService(device, this.transportServiceResolver, this.configService);
        }
        return new Esp32ControlService(device, this.transportServiceResolver, this.configService);
    }
}
