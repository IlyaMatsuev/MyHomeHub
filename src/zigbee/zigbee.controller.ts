import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { ZIGBEE_BRIDGE_DEVICES_TOPIC, ZIGBEE_DEVICE_STATE_TOPIC } from 'zigbee/zigbee.constants';
import { ZigbeeDevice } from 'zigbee/interfaces';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { MqttService } from 'mqtt/mqtt.service';

@Controller()
export class ZigbeeController {
    private readonly logger = new Logger(ZigbeeController.name);

    // TODO: Listen to friendly name rename topic
    constructor(
        private readonly mqttService: MqttService,
        private readonly zigbeeService: ZigbeeService,
    ) {}

    @MessagePattern(ZIGBEE_BRIDGE_DEVICES_TOPIC)
    onConnectedDevicesListChange(@Ctx() context: MqttContext, @Payload() devices: Array<ZigbeeDevice>): void {
        this.logger.debug(`[${context.getTopic()}]: Update ZigBee devices list: ${JSON.stringify(devices)}`);
        this.zigbeeService.savePairableDevices(devices ?? []);
    }

    @MessagePattern(ZIGBEE_DEVICE_STATE_TOPIC)
    async onDeviceStateChange(@Ctx() context: MqttContext, @Payload() state: Record<string, unknown>): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Update ZigBee device state: ${JSON.stringify(state)}`);

        const [friendlyName] = this.mqttService.extractTopicWildcards(ZIGBEE_DEVICE_STATE_TOPIC, context.getTopic());
        if (friendlyName === 'bridge' || friendlyName.startsWith('bridge/')) {
            this.logger.debug(`Bridge state update, skipping`);
            return;
        }

        await this.zigbeeService.updateDeviceState(friendlyName, state);
    }
}
