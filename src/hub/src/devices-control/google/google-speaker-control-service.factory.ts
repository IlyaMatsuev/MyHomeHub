import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceType } from 'devices/interfaces';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';
import { GoogleSpeakerControlService } from 'devices-control/google/google-speaker-control.service';

@Injectable()
export class GoogleSpeakerControlServiceFactory implements DeviceControlServiceFactory {
    constructor(private readonly configService: ConfigService) {}

    eligible(device: Device): boolean {
        return device.type === DeviceType.GoogleSpeaker;
    }

    createService(device: Device): GoogleSpeakerControlService {
        return new GoogleSpeakerControlService(device, this.configService);
    }
}
