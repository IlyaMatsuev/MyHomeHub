import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import {
    ZIGBEE_BRIDGE_DEVICE_RENAME_RESPONSE_TOPIC,
    ZIGBEE_BRIDGE_DEVICES_TOPIC,
    ZIGBEE_BRIDGE_HEALTH,
    ZIGBEE_BRIDGE_STATE_TOPIC,
    ZIGBEE_DEVICE_STATE_TOPIC,
} from 'zigbee/zigbee.constants';
import { ZigbeeBridgeHealth, ZigbeeBridgeState, ZigbeeBridgeStatePayload, ZigbeeDevice } from 'zigbee/interfaces';
import { ZigbeePairableDevices } from 'zigbee/store';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { MqttService } from 'mqtt/mqtt.service';
import { ZigbeeBridge } from 'zigbee/store/zigbee-bridge';

/**
 * Docs: https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html
 */
@Controller()
export class ZigbeeController {
    private readonly logger = new Logger(ZigbeeController.name);

    constructor(
        private readonly mqttService: MqttService,
        private readonly zigbeeService: ZigbeeService,
    ) {}

    @MessagePattern(ZIGBEE_BRIDGE_HEALTH)
    onBridgeHealthCheck(@Ctx() context: MqttContext, @Payload() health: ZigbeeBridgeHealth): void {
        this.logger.debug(`[${context.getTopic()}]: Update bridge health details: ${JSON.stringify(health)}`);
        ZigbeeBridge.save(health);
    }

    @MessagePattern(ZIGBEE_BRIDGE_STATE_TOPIC)
    onBridgeAvailabilityChange(@Ctx() context: MqttContext, @Payload() payload: ZigbeeBridgeStatePayload): void {
        this.logger.debug(`[${context.getTopic()}]: Update bridge availability: ${JSON.stringify(payload)}`);
        ZigbeeBridge.saveState(this.extractBridgeState(payload));
    }

    @MessagePattern(ZIGBEE_BRIDGE_DEVICES_TOPIC)
    async onConnectedDevicesListChange(@Ctx() context: MqttContext, @Payload() devices: Array<ZigbeeDevice>): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Update ZigBee devices list: ${JSON.stringify(devices)}`);
        // Save cache first to avoid potential double renaming in DevicesService.updateDevice()
        ZigbeePairableDevices.save(devices ?? []);
        await this.zigbeeService.syncFriendlyNames(devices ?? []);
    }

    @MessagePattern(ZIGBEE_DEVICE_STATE_TOPIC)
    async onDeviceStateChange(@Ctx() context: MqttContext, @Payload() state: Record<string, unknown>): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Update ZigBee device state: ${JSON.stringify(state)}`);

        const friendlyName = this.extractFriendlyName(ZIGBEE_DEVICE_STATE_TOPIC, context.getTopic());
        if (friendlyName) {
            // The only proof the hub has that the Zigbee dongle is still receiving, see ZigbeeHealthMonitorService
            ZigbeeBridge.trackDeviceMessage();
            await this.zigbeeService.handleDeviceStateUpdate(friendlyName, state);
        }
    }

    @MessagePattern(ZIGBEE_BRIDGE_DEVICE_RENAME_RESPONSE_TOPIC)
    async onDeviceFriendlyNameChange(@Ctx() context: MqttContext, @Payload() response: Record<string, unknown>): Promise<void> {
        this.logger.debug(`[${context.getTopic()}]: Update ZigBee device friendly name response: ${JSON.stringify(response)}`);

        const { from, to } = response as { from: string; to: string };
        if (from && to) {
            await this.zigbeeService.handleDeviceExternalRename(from, to);
        } else {
            this.logger.warn(`Failed to rename a Zigbee device from "${from}" to "${to}"`);
        }
    }

    private extractBridgeState(payload: ZigbeeBridgeStatePayload): ZigbeeBridgeState {
        const state = typeof payload === 'string' ? payload : payload?.state;
        if (state !== ZigbeeBridgeState.Online && state !== ZigbeeBridgeState.Offline) {
            this.logger.warn(`Unknown Zigbee2Mqtt bridge state received: ${JSON.stringify(payload)}`);
            return null;
        }
        return state;
    }

    private extractFriendlyName(topicPattern: string, topic: string): string | null {
        const [friendlyName] = this.mqttService.extractTopicWildcards(topicPattern, topic);
        if (friendlyName === 'bridge' || friendlyName.startsWith('bridge/')) {
            this.logger.debug(`Bridge state update, skipping`);
            return null;
        }
        return friendlyName;
    }
}
