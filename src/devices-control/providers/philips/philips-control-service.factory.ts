import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { PhilipsControlService } from './philips-control.service';
import { DEVICE_TRANSPORT_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';

@Injectable()
export class PhilipsControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        @Inject(DEVICE_TRANSPORT_FACTORY_PROVIDER)
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        private readonly configService: ConfigService,
        private readonly deviceConfigsMapper: DeviceConfigsMapperService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand === DeviceBrand.Philips;
    }

    createService(device: Device): PhilipsControlService {
        return new PhilipsControlService(device, this.transportServiceResolver, this.configService, this.deviceConfigsMapper);
    }
}
