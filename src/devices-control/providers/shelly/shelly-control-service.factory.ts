import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand, DeviceType } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { ShellyControlService } from 'devices-control/providers';
import { ShellyLedControlService } from 'devices-control/providers/shelly/led';
import { DEVICE_TRANSPORT_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';

@Injectable()
export class ShellyControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        @Inject(DEVICE_TRANSPORT_FACTORY_PROVIDER)
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        private readonly configService: ConfigService,
        private readonly deviceConfigsMapper: DeviceConfigsMapperService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.Shelly;
    }

    createService(device: Device): ShellyControlService {
        if (device.type === DeviceType.LED) {
            return new ShellyLedControlService(device, this.transportServiceResolver, this.configService, this.deviceConfigsMapper);
        }
        return new ShellyControlService(device, this.transportServiceResolver, this.configService, this.deviceConfigsMapper);
    }
}
