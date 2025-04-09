import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Device, DeviceType } from 'devices/interfaces';
import {
    DeviceControlService,
    ShellyDeviceControlService,
    GoogleSpeakerDeviceControlService,
    TuyaDeviceControlService,
} from 'devices/control-services';

@Injectable()
export class DeviceControlServiceFactory {
    private static controlServices: { [key in DeviceType]: new (device: Device, configService: ConfigService) => DeviceControlService };

    constructor(private readonly configService: ConfigService) {}

    getControlService<T extends DeviceControlService>(device: Device): T {
        const ControlServiceClass = this.getControlServiceClassByType(device.type);
        if (!ControlServiceClass) {
            throw new Error(`The device of type "${device.type}" does not have an implementation of a device control service yet`);
        }
        return new ControlServiceClass(device, this.configService) as T;
    }

    private getControlServiceClassByType(type: string): new (device: Device, configService: ConfigService) => DeviceControlService {
        if (!DeviceControlServiceFactory.controlServices) {
            DeviceControlServiceFactory.controlServices = {
                [DeviceType.ShellyPlug]: ShellyDeviceControlService,
                [DeviceType.GoogleSpeaker]: GoogleSpeakerDeviceControlService,
                [DeviceType.TuyaDevice]: TuyaDeviceControlService,
                [DeviceType.ESP32]: undefined,
            };
        }
        return DeviceControlServiceFactory.controlServices[type];
    }
}
