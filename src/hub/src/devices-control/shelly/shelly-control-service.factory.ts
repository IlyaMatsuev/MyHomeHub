import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceType } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { ShellyControlService } from 'devices-control/shelly/shelly-control.service';

@Injectable()
export class ShellyControlServiceFactory implements DeviceControlServiceFactory {
    constructor(private readonly configService: ConfigService) {}

    eligible(device: Device): boolean {
        return device.type === DeviceType.ShellyPlug;
    }

    createService(device: Device): ShellyControlService {
        return new ShellyControlService(device, this.configService);
    }
}
