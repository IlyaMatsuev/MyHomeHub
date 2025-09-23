import { CreateDeviceDto } from 'devices/dto';
import { DeviceBrand, DevicePayload, DeviceType } from 'devices/interfaces';
import { MEASUREMENTS_DEFAULT_UPDATE_INTERVAL } from 'mqtt/mqtt.constants';

export class PairRequestDto {
    deviceIp: string;
    deviceName: string;
    deviceType: DeviceType;
    updateInterval?: number;
    controls?: DevicePayload;
    measurements?: DevicePayload;

    toCreateDevice(): CreateDeviceDto {
        return new CreateDeviceDto({
            name: this.deviceName,
            type: this.deviceType,
            brand: DeviceBrand.ESP32,
            updateInterval: this.updateInterval ?? MEASUREMENTS_DEFAULT_UPDATE_INTERVAL,
            ip: this.deviceIp,
            controls: this.controls ?? {},
            measurements: this.measurements ?? {},
        });
    }
}
