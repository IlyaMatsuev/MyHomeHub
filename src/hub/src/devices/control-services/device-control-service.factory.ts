import { Injectable } from '@nestjs/common';
import { Device, DeviceType } from 'devices/interfaces';
import { BaseDeviceControlService, ShellyDeviceControlService } from 'devices/control-services';

@Injectable()
export class DeviceControlServiceFactory {
    private static controlServices: { [key in DeviceType]: new (device: Device) => BaseDeviceControlService };

    getControlService<T extends BaseDeviceControlService>(device: Device): T {
        const ControlServiceClass = this.getControlServiceClassByType(device.type);
        if (!ControlServiceClass) {
            throw new Error(`The device of type "${device.type}" does not have an implementation of a device control service yet`);
        }
        return new ControlServiceClass(device) as T;
    }

    private getControlServiceClassByType(type: string): new (device: Device) => BaseDeviceControlService {
        if (!DeviceControlServiceFactory.controlServices) {
            DeviceControlServiceFactory.controlServices = {
                [DeviceType.ShellyPlug]: ShellyDeviceControlService,
                [DeviceType.ESP32]: undefined,
                [DeviceType.Socket]: undefined,
                [DeviceType.Switch]: undefined,
            };
        }
        return DeviceControlServiceFactory.controlServices[type];
    }
}
