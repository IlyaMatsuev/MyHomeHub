import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
    CONTROLS_UPDATE_TOPIC_NAME,
    DEVICE_PAIR_REPLY_TOPIC_NAME,
    MQTT_CLIENT_PROVIDER_NAME,
    ZIGBEE2MQTT_BASE_TOPIC,
    ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC,
    ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC,
    ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC,
} from 'mqtt/mqtt.constants';
import { Device } from 'devices/interfaces';
import { PairAcceptDto } from 'mqtt/dto';

@Injectable()
export class MqttService {
    constructor(@Inject(MQTT_CLIENT_PROVIDER_NAME) private readonly client: ClientProxy) {}

    pairDevice(device: Device) {
        this.client.emit(DEVICE_PAIR_REPLY_TOPIC_NAME, PairAcceptDto.accept(device.externalId, device.controls, device.updateInterval));
    }

    rejectDevice(reason: string) {
        this.client.emit(DEVICE_PAIR_REPLY_TOPIC_NAME, PairAcceptDto.reject(`Device pairing has been rejected: ${reason}`));
    }

    async updateDeviceControls<T>(deviceId: string, controls: T): Promise<void> {
        this.client.emit(CONTROLS_UPDATE_TOPIC_NAME.replace('+', deviceId), controls);
    }

    async publishZigbeeCommand(friendlyName: string, payload: object): Promise<void> {
        this.client.emit(`${ZIGBEE2MQTT_BASE_TOPIC}/${friendlyName}/set`, payload);
    }

    async setZigbeePermitJoin(enable: boolean, seconds?: number): Promise<void> {
        const payload: { value: boolean; time?: number } = { value: enable };
        if (seconds !== undefined) {
            payload.time = seconds;
        }
        this.client.emit(ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC, payload);
    }

    async renameZigbeeDevice(ieeeAddress: string, newFriendlyName: string): Promise<void> {
        this.client.emit(ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC, {
            from: ieeeAddress,
            to: newFriendlyName,
        });
    }

    async removeZigbeeDevice(ieeeAddress: string, forceRemove = false): Promise<void> {
        this.client.emit(ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, {
            id: ieeeAddress,
            force: forceRemove,
        });
    }
}
