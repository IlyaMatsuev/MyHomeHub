import { Injectable } from '@nestjs/common';
import { Device, DeviceType } from 'devices/interfaces';
import { DeviceControlService, ShellyDeviceControlService, GoogleSpeakerDeviceControlService } from 'devices/control-services';

@Injectable()
export class DeviceControlServiceFactory {
    private static controlServices: { [key in DeviceType]: new (device: Device) => DeviceControlService };

    getControlService<T extends DeviceControlService>(device: Device): T {
        const ControlServiceClass = this.getControlServiceClassByType(device.type);
        if (!ControlServiceClass) {
            throw new Error(`The device of type "${device.type}" does not have an implementation of a device control service yet`);
        }
        return new ControlServiceClass(device) as T;
    }

    private getControlServiceClassByType(type: string): new (device: Device) => DeviceControlService {
        if (!DeviceControlServiceFactory.controlServices) {
            DeviceControlServiceFactory.controlServices = {
                [DeviceType.ShellyPlug]: ShellyDeviceControlService,
                [DeviceType.GoogleSpeaker]: GoogleSpeakerDeviceControlService,
                [DeviceType.ESP32]: undefined,
                [DeviceType.Socket]: undefined,
                [DeviceType.Switch]: undefined,
            };
        }
        return DeviceControlServiceFactory.controlServices[type];
    }
}
