import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { GoogleSpeakerControlService } from 'devices-control/providers';
import { DEVICE_TRANSPORT_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { DeviceTransportServiceResolver } from 'devices-control/transport';

@Injectable()
export class GoogleSpeakerControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        @Inject(DEVICE_TRANSPORT_FACTORY_PROVIDER)
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        private readonly configService: ConfigService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.Google;
    }

    createService(device: Device): GoogleSpeakerControlService {
        return new GoogleSpeakerControlService(device, this.transportServiceResolver, this.configService);
    }
}
