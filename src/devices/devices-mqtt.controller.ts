import { Controller, Logger } from '@nestjs/common';
import { DevicesMqttService } from 'devices/devices-mqtt.service';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { DeviceControlsDto, DevicePayloadDto, PairRequestDto } from 'devices/dto';
import { plainToInstance } from 'class-transformer';
import {
    ESP32_DEVICE_CONTROLS_SYNC_TOPIC,
    ESP32_DEVICE_MEASUREMENTS_UPDATE_TOPIC,
    ESP32_DEVICE_PAIR_REQUEST_TOPIC,
} from 'devices/devices.constants';
import { MqttService } from 'mqtt/mqtt.service';

@Controller()
export class DevicesMqttController {
    private readonly logger = new Logger(DevicesMqttController.name);

    constructor(
        private readonly mqttService: MqttService,
        private readonly deviceMqttService: DevicesMqttService,
    ) {}

    @MessagePattern(ESP32_DEVICE_PAIR_REQUEST_TOPIC)
    async onEsp32DevicePairRequest(@Ctx() context: MqttContext, @Payload() pairRequest: PairRequestDto): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Pair request: ${JSON.stringify(pairRequest)}`);
        await this.deviceMqttService.handleEsp32DevicePairRequest(plainToInstance(PairRequestDto, pairRequest));
    }

    @MessagePattern(ESP32_DEVICE_CONTROLS_SYNC_TOPIC)
    async onEsp32DeviceControlsSync(@Ctx() context: MqttContext, @Payload('controls') controls: DeviceControlsDto): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Sync controls: ${JSON.stringify({ controls })}`);

        const deviceId = this.extractDeviceId(ESP32_DEVICE_CONTROLS_SYNC_TOPIC, context.getTopic());
        if (deviceId) {
            await this.deviceMqttService.handleEsp32DeviceControlsSync(deviceId, controls);
        }
    }

    @MessagePattern(ESP32_DEVICE_MEASUREMENTS_UPDATE_TOPIC)
    async onEsp32DeviceMeasurementsUpdate(
        @Ctx() context: MqttContext,
        @Payload('measurements') measurements: DevicePayloadDto,
    ): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Update measurements: ${JSON.stringify({ measurements })}`);

        const deviceId = this.extractDeviceId(ESP32_DEVICE_MEASUREMENTS_UPDATE_TOPIC, context.getTopic());
        if (deviceId) {
            await this.deviceMqttService.handleEsp32DeviceMeasurementsUpdate(deviceId, measurements);
        }
    }

    private extractDeviceId(topicPattern: string, topic: string): string {
        const [deviceId] = this.mqttService.extractTopicWildcards(topicPattern, topic);
        return deviceId;
    }
}
