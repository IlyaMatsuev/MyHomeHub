import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { MqttService } from 'mqtt/mqtt.service';
import {
    CONTROLS_SYNC_TOPIC_NAME,
    DEVICE_PAIR_REPLY_TOPIC_NAME,
    DEVICE_PAIR_REQUEST_TOPIC_NAME,
    MEASUREMENTS_UPDATE_TOPIC_NAME,
} from 'mqtt/mqtt.constants';
import { DevicesService } from 'devices/devices.service';
import { PairAcceptDto, PairRequestDto } from 'mqtt/dto';
import { DeviceControlsDto, DevicePayloadDto, UpdateDeviceDto } from 'devices/dto';
import { plainToInstance } from 'class-transformer';
import { Device } from 'devices/interfaces';

@Controller()
export class MqttController {
    private readonly logger = new Logger(MqttController.name);

    constructor(
        private readonly mqttService: MqttService,
        private readonly devicesService: DevicesService,
    ) {}

    // TODO: Move these methods from here
    @MessagePattern(DEVICE_PAIR_REQUEST_TOPIC_NAME)
    async onHomeDevicePairRequest(@Ctx() context: MqttContext, @Payload() pairRequest: PairRequestDto): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Pair request: ${JSON.stringify(pairRequest)}`);

        try {
            pairRequest = plainToInstance(PairRequestDto, pairRequest);
            this.logger.log(`Received a device (${pairRequest?.deviceName}) pairing request with IP "${pairRequest?.deviceIp}"`);

            if (!pairRequest?.deviceIp || !pairRequest?.deviceName) {
                this.logger.debug(`No device ip and name provided: ${JSON.stringify(context.getPacket())}`);
                return;
            }

            let existingDevice = await this.devicesService.getDeviceByIp(pairRequest.deviceIp, { strict: false });
            if (!existingDevice) {
                existingDevice = await this.devicesService.addDevice(pairRequest.toCreateDevice());
            } else {
                await this.devicesService.updateDevice(
                    existingDevice.externalId,
                    new UpdateDeviceDto({
                        controls: pairRequest.controls,
                        measurements: pairRequest.measurements,
                    }),
                );
            }
            this.pairDevice(existingDevice);
            this.logger.log(`Device (${existingDevice.externalId}) has been successfully paired`);
        } catch (error) {
            this.rejectDevice(`${error}`);
            this.logger.error(`Error while pairing a device (${pairRequest?.deviceName}) with IP "${pairRequest?.deviceIp}"`);
            this.logger.error(error);
        }
    }

    @MessagePattern(CONTROLS_SYNC_TOPIC_NAME)
    async onHomeControlsSync(@Ctx() context: MqttContext, @Payload('controls') controls: DeviceControlsDto): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Sync controls: ${JSON.stringify({ controls })}`);

        const [deviceId] = this.mqttService.extractTopicWildcards(CONTROLS_SYNC_TOPIC_NAME, context.getTopic());
        try {
            this.logger.debug(`Syncing controls for a device with id "${deviceId}"`);
            await this.devicesService.updateDevice(deviceId, new UpdateDeviceDto({ controls }));
        } catch (error) {
            this.logger.error(`Error while syncing controls for a device with id "${deviceId}"`);
            this.logger.error(error);
        }
    }

    @MessagePattern(MEASUREMENTS_UPDATE_TOPIC_NAME)
    async onHomeMeasurementsUpdate(@Ctx() context: MqttContext, @Payload('measurements') measurements: DevicePayloadDto): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Update measurements: ${JSON.stringify({ measurements })}`);

        const [deviceId] = this.mqttService.extractTopicWildcards(MEASUREMENTS_UPDATE_TOPIC_NAME, context.getTopic());
        try {
            this.logger.debug(`Updating measurements for a device with id "${deviceId}": ${JSON.stringify(measurements)}`);
            await this.devicesService.updateDevice(deviceId, new UpdateDeviceDto({ measurements }));
        } catch (error) {
            this.logger.error(`Error while retrieving measurements for a device with id "${deviceId}"`);
            this.logger.error(error);
        }
    }

    private pairDevice(device: Device) {
        this.mqttService.publish(
            DEVICE_PAIR_REPLY_TOPIC_NAME,
            PairAcceptDto.accept(device.externalId, device.controls, device.updateInterval),
        );
    }

    private rejectDevice(reason: string) {
        this.mqttService.publish(DEVICE_PAIR_REPLY_TOPIC_NAME, PairAcceptDto.reject(`Device pairing has been rejected: ${reason}`));
    }
}
