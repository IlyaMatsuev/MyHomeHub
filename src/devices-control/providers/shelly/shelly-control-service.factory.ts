import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { ShellyControlService } from 'devices-control/providers';
import { DEVICE_TRANSPORT_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { DeviceTransportServiceResolver } from 'devices-control/transport';

@Injectable()
export class ShellyControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        @Inject(DEVICE_TRANSPORT_FACTORY_PROVIDER)
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        private readonly configService: ConfigService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.Shelly;
    }

    createService(device: Device): ShellyControlService {
        return new ShellyControlService(device, this.transportServiceResolver, this.configService);
    }
}
