import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { MqttService } from 'mqtt/mqtt.service';
import { MEASUREMENTS_UPDATE_TOPIC_NAME, MQTT_TOPIC_PARTS_SEPARATOR, MQTT_TOPIC_PARTS_WILDCARD } from 'mqtt/mqtt.constants';
import { DevicesService } from 'devices/devices.service';

@Controller()
export class MqttController {
    private readonly logger = new Logger(MqttController.name);

    constructor(
        private readonly mqttService: MqttService,
        private readonly devicesService: DevicesService,
    ) {}

    @MessagePattern(MEASUREMENTS_UPDATE_TOPIC_NAME)
    async onHomeMeasurementsUpdate(
        @Ctx() context: MqttContext,
        @Payload('measurements') measurements: Record<string, unknown>,
    ): Promise<void> {
        const [deviceId] = this.extractTopicWildcards(MEASUREMENTS_UPDATE_TOPIC_NAME, context.getTopic());
        try {
            this.logger.debug(`Updating measurements for a device with id "${deviceId}": ${JSON.stringify(measurements)}`);
            const device = await this.devicesService.getDeviceByExternalId(deviceId);
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
