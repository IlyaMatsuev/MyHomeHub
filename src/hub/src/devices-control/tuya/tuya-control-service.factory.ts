import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceType } from 'devices/interfaces';
import { TuyaControlService } from 'devices-control/tuya/tuya-control.service';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';

@Injectable()
export class TuyaControlServiceFactory implements DeviceControlServiceFactory {
    constructor(private readonly configService: ConfigService) {}

    eligible(device: Device): boolean {
        return device.type == DeviceType.TuyaDevice;
    }

    createService(device: Device): TuyaControlService {
        return new TuyaControlService(device, this.configService);
    }
}
