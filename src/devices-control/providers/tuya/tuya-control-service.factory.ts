import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceBrand } from 'devices/interfaces';
import { TuyaControlService } from 'devices-control/providers';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { DEVICE_TRANSPORT_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { DeviceTransportServiceResolver } from 'devices-control/transport';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';

@Injectable()
export class TuyaControlServiceFactory implements DeviceControlServiceFactory {
    constructor(
        @Inject(DEVICE_TRANSPORT_FACTORY_PROVIDER)
        protected readonly transportServiceResolver: DeviceTransportServiceResolver,
        private readonly configService: ConfigService,
        private readonly deviceConfigsMapper: DeviceConfigsMapperService,
    ) {}

    eligible(device: Device): boolean {
        return device.brand == DeviceBrand.Tuya;
    }

    createService(device: Device): TuyaControlService {
        return new TuyaControlService(device, this.transportServiceResolver, this.configService, this.deviceConfigsMapper);
    }
}
