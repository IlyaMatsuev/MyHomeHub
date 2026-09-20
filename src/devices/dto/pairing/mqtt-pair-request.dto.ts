import { CreateDeviceDto } from 'devices/dto';
import { DeviceBrand, DevicePayload, DeviceType } from 'devices/interfaces';
import { ESP32_DEVICE_MEASUREMENTS_DEFAULT_UPDATE_INTERVAL } from 'devices/devices.constants';
import { TransportProtocol } from 'devices-control/interfaces';

export class MqttPairRequestDto {
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
            updateInterval: this.updateInterval ?? ESP32_DEVICE_MEASUREMENTS_DEFAULT_UPDATE_INTERVAL,
            ip: this.deviceIp,
            transportProtocol: TransportProtocol.Mqtt,
            controls: this.controls ?? {},
            measurements: this.measurements ?? {},
        });
    }
}
