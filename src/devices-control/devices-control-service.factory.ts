import { Injectable } from '@nestjs/common';
import { Device } from 'devices/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { DeviceControlServiceFactory } from 'devices-control/interfaces';

@Injectable()
export class DevicesControlServiceFactory {
    constructor(private readonly controlServiceFactories: Array<DeviceControlServiceFactory>) {}

    getControlService(device: Device): DevicesControlService | never {
        for (const controlService of this.controlServiceFactories) {
            if (controlService.eligible(device)) {
                return controlService.createService(device);
            }
        }
        throw new Error(`The device of type "${device.type}" does not have an implementation of a device control service yet`);
    }
}
