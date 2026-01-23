import { Device } from 'devices/interfaces';
import { DevicesControlService } from 'devices-control/devices-control.service';

export interface DeviceControlServiceFactory {
    eligible(device: Device): boolean;
    createService(device: Device): DevicesControlService;
}
