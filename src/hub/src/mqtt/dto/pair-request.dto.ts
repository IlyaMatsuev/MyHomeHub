import { CreateDeviceDto } from 'devices/dto';
import { DeviceType } from 'devices/interfaces';
import { MEASUREMENTS_DEFAULT_UPDATE_INTERVAL } from 'mqtt/mqtt.constants';

export class PairRequestDto {
    deviceIp: string;
    deviceName: string;
    updateInterval?: number;
    controls?: Record<string, object>;
    measurements?: Record<string, object>;

    toCreateDevice(): CreateDeviceDto {
        return new CreateDeviceDto({
            name: this.deviceName,
            type: DeviceType.ESP32,
            updateInterval: this.updateInterval ?? MEASUREMENTS_DEFAULT_UPDATE_INTERVAL,
            deviceAddress: `http://${this.deviceIp}`,
            controls: this.controls,
            measurements: this.measurements,
        });
    }
}
