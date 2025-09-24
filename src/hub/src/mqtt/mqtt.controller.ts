import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { MqttService } from 'mqtt/mqtt.service';
import {
    CONTROLS_SYNC_TOPIC_NAME,
    DEVICE_PAIR_REQUEST_TOPIC_NAME,
    MEASUREMENTS_UPDATE_TOPIC_NAME,
    MQTT_TOPIC_PARTS_SEPARATOR,
    MQTT_TOPIC_PARTS_WILDCARD,
} from 'mqtt/mqtt.constants';
import { DevicesService } from 'devices/devices.service';
import { PairRequestDto } from 'mqtt/dto';
import { DevicePayloadDto, UpdateDeviceDto } from 'devices/dto';
import { plainToInstance } from 'class-transformer';

@Controller()
export class MqttController {
    private readonly logger = new Logger(MqttController.name);

    constructor(
        private readonly mqttService: MqttService,
        private readonly devicesService: DevicesService,
    ) {}

    @MessagePattern(DEVICE_PAIR_REQUEST_TOPIC_NAME)
    async onHomeDevicePairRequest(@Ctx() context: MqttContext, @Payload() pairRequest: PairRequestDto): Promise<void> {
        try {
            pairRequest = plainToInstance(PairRequestDto, pairRequest);
            this.logger.log(`Received a device (${pairRequest?.deviceName}) pairing request with IP "${pairRequest?.deviceIp}"`);
            this.logger.debug(`Pair request: ${JSON.stringify(pairRequest)}`);

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
            this.mqttService.pairDevice(existingDevice);
            this.logger.log(`Device (${existingDevice.externalId}) has been successfully paired`);
        } catch (error) {
            this.mqttService.rejectDevice(`${error}`);
            this.logger.error(`Error while pairing a device (${pairRequest?.deviceName}) with IP "${pairRequest?.deviceIp}"`);
            this.logger.error(error);
        }
    }

    @MessagePattern(CONTROLS_SYNC_TOPIC_NAME)
    async onHomeControlsSync(@Ctx() context: MqttContext, @Payload('controls') controls: DevicePayloadDto): Promise<void> {
        const [deviceId] = this.extractTopicWildcards(CONTROLS_SYNC_TOPIC_NAME, context.getTopic());
        try {
            this.logger.debug(`Syncing controls for a device with id "${deviceId}": ${JSON.stringify(controls)}`);
            await this.devicesService.updateDevice(deviceId, new UpdateDeviceDto({ controls }));
        } catch (error) {
            this.logger.error(`Error while syncing controls for a device with id "${deviceId}"`);
            this.logger.error(error);
        }
    }

    @MessagePattern(MEASUREMENTS_UPDATE_TOPIC_NAME)
    async onHomeMeasurementsUpdate(@Ctx() context: MqttContext, @Payload('measurements') measurements: DevicePayloadDto): Promise<void> {
        const [deviceId] = this.extractTopicWildcards(MEASUREMENTS_UPDATE_TOPIC_NAME, context.getTopic());
        try {
            this.logger.debug(`Updating measurements for a device with id "${deviceId}": ${JSON.stringify(measurements)}`);
            await this.devicesService.updateDevice(deviceId, new UpdateDeviceDto({ measurements }));
        } catch (error) {
            this.logger.error(`Error while retrieving measurements for a device with id "${deviceId}"`);
            this.logger.error(error);
        }
    }

    private extractTopicWildcards(pattern: string, topic: string): Array<string> {
        const patternTopicParts = pattern.split(MQTT_TOPIC_PARTS_SEPARATOR);
        const topicParts = topic.split(MQTT_TOPIC_PARTS_SEPARATOR);

        return patternTopicParts.reduce((wildcardValues, part, i) => {
            if (part === MQTT_TOPIC_PARTS_WILDCARD) {
                wildcardValues.push(topicParts[i]);
            }
            return wildcardValues;
        }, []);
    }
}
