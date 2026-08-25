import { Injectable, Logger } from '@nestjs/common';
import { PairAcceptDto, PairRequestDto, DeviceControlsDto, DevicePayloadDto, UpdateDeviceDto } from 'devices/dto';
import { DevicesService } from 'devices/devices.service';
import { Device, DeviceUpdateOrigin } from 'devices/interfaces';
import { MqttService } from 'mqtt/mqtt.service';
import { ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC } from 'devices/devices.constants';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { stripEmptyValues } from 'devices-control/utils';

@Injectable()
export class DevicesMqttService {
    private readonly logger = new Logger(DevicesMqttService.name);

    constructor(
        private readonly mqttService: MqttService,
        private readonly devicesService: DevicesService,
        private readonly deviceConfigsMapper: DeviceConfigsMapperService,
    ) {}

    async handleEsp32DevicePairRequest(pairRequest: PairRequestDto): Promise<void> {
        try {
            this.logger.log(`Received a device (${pairRequest?.deviceName}) pairing request with IP "${pairRequest?.deviceIp}"`);

            if (!pairRequest?.deviceIp || !pairRequest?.deviceName) {
                this.logger.debug(`No device ip and name provided: ${JSON.stringify(pairRequest)}`);
                return;
            }

            let existingDevice = await this.devicesService.getDeviceByIp(pairRequest.deviceIp);
            if (!existingDevice) {
                existingDevice = await this.devicesService.addDevice(pairRequest.toCreateDevice(), { origin: DeviceUpdateOrigin.Device });
            } else {
                await this.devicesService.updateDevice(
                    existingDevice.externalId,
                    new UpdateDeviceDto({
                        controls: pairRequest.controls,
                        measurements: pairRequest.measurements,
                    }),
                    { propagateControls: false, origin: DeviceUpdateOrigin.Device },
                );
            }
            this.pairEsp32Device(existingDevice);
            this.logger.log(`Device (${existingDevice.externalId}) has been successfully paired`);
        } catch (error) {
            this.rejectEsp32Device(`${error}`);
            this.logger.error(`Error while pairing a device (${pairRequest?.deviceName}) with IP "${pairRequest?.deviceIp}"`);
            this.logger.error(error);
        }
    }

    async handleEsp32DeviceControlsSync(deviceId: string, controls: DeviceControlsDto): Promise<void> {
        const device = await this.devicesService.getDeviceByExternalId(deviceId, { strict: false });
        if (!device) {
            this.logger.warn(`No device found to sync controls for device "${deviceId}"`);
            return;
        }

        try {
            this.logger.debug(`Syncing controls for a device with id "${deviceId}"`);
            const mappedControls = await this.deviceConfigsMapper.mapPayloadFromDevice(device, 'controls', controls);
            await this.devicesService.updateDevice(deviceId, new UpdateDeviceDto({ controls: mappedControls }), {
                propagateControls: false,
                origin: DeviceUpdateOrigin.Device,
            });
        } catch (error) {
            this.logger.error(`Error while syncing controls for a device with id "${deviceId}"`);
            this.logger.error(error);
        }
    }

    async handleEsp32DeviceMeasurementsUpdate(deviceId: string, measurements: DevicePayloadDto): Promise<void> {
        const device = await this.devicesService.getDeviceByExternalId(deviceId, { strict: false });
        if (!device) {
            this.logger.warn(`No device found to update measurements for device "${deviceId}"`);
            return;
        }

        try {
            this.logger.debug(`Updating measurements for a device with id "${deviceId}": ${JSON.stringify(measurements)}`);
            const mappedMeasurements = await this.deviceConfigsMapper.mapPayloadFromDevice(device, 'measurements', measurements);
            await this.devicesService.updateDevice(deviceId, new UpdateDeviceDto({ measurements: mappedMeasurements }), {
                propagateControls: true,
                origin: DeviceUpdateOrigin.Device,
            });
        } catch (error) {
            this.logger.error(`Error while retrieving measurements for a device with id "${deviceId}"`);
            this.logger.error(error);
        }
    }

    private pairEsp32Device(device: Device) {
        this.mqttService.publish(
            ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC,
            PairAcceptDto.accept(device.externalId, stripEmptyValues(device.controls), device.updateInterval),
        );
    }

    private rejectEsp32Device(reason: string) {
        this.mqttService.publish(
            ESP32_DEVICE_PAIR_REQUEST_REPLY_TOPIC,
            PairAcceptDto.reject(`Device pairing has been rejected: ${reason}`),
        );
    }
}
