import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { MqttService } from 'mqtt/mqtt.service';
import {
    DEVICE_PAIR_REQUEST_TOPIC_NAME,
    MEASUREMENTS_UPDATE_TOPIC_NAME,
    MQTT_TOPIC_PARTS_SEPARATOR,
    MQTT_TOPIC_PARTS_WILDCARD,
} from 'mqtt/mqtt.constants';
import { DevicesService } from 'devices/devices.service';
import { PairRequestDto } from 'mqtt/dto';

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
            this.logger.log(`Received a device (${pairRequest?.deviceName}) pairing request with IP "${pairRequest?.deviceIp}"`);
            if (!pairRequest?.deviceIp || !pairRequest?.deviceName) {
                this.logger.debug(`No device ip and name provided: ${JSON.stringify(context.getPacket())}`);
                return;
            }

            let existingDevice = await this.devicesService.getDeviceByIp(pairRequest.deviceIp, { strict: false });
            if (!existingDevice) {
                existingDevice = await this.devicesService.addDevice(pairRequest.toCreateDevice());
            }
            this.mqttService.pairDevice(existingDevice);
            this.logger.log(`Device (${existingDevice.externalId}) has been successfully paired`);
        } catch (error) {
            this.mqttService.rejectDevice(`${error}`);
            this.logger.error(`Error while pairing a device (${pairRequest?.deviceName}) with IP "${pairRequest?.deviceIp}"`);
            this.logger.error(error);
        }
    }

    @MessagePattern(MEASUREMENTS_UPDATE_TOPIC_NAME)
    async onHomeMeasurementsUpdate(
        @Ctx() context: MqttContext,
        @Payload('measurements') measurements: Record<string, unknown>,
    ): Promise<void> {
        const [deviceId] = this.extractTopicWildcards(MEASUREMENTS_UPDATE_TOPIC_NAME, context.getTopic());
        try {
            this.logger.debug(`Updating measurements for a device with id "${deviceId}": ${JSON.stringify(measurements)}`);
            const device = await this.devicesService.getDeviceByExternalId(deviceId);
            // TODO: Update measurements
            this.logger.debug(`Device name: ${device.name}`);
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
