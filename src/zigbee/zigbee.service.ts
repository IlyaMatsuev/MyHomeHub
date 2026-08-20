import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MqttService } from 'mqtt/mqtt.service';
import { UpdateDeviceDto } from 'devices/dto';
import { DevicesService } from 'devices/devices.service';
import {
    ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC,
    ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC,
    ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC,
} from 'zigbee/zigbee.constants';
import { ZigbeeBridge } from 'zigbee/store/zigbee-bridge';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceUpdateRequestedEvent } from 'devices/events';

@Injectable()
export class ZigbeeService {
    private readonly logger = new Logger(ZigbeeService.name);

    constructor(
        private readonly mqttService: MqttService,
        @Inject(forwardRef(() => DevicesService))
        private readonly devicesService: DevicesService,
        private readonly deviceConfigsMapper: DeviceConfigsMapperService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    setPermitJoin(enable: boolean, seconds: number): void {
        if (!ZigbeeBridge.connected()) {
            return;
        }

        const payload: { value: boolean; time?: number } = { value: enable };
        if (seconds !== undefined) {
            payload.time = seconds;
        }
        this.mqttService.publish(ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC, payload);
    }

    renameDevice(ieeeAddress: string, newFriendlyName: string): void {
        if (ZigbeeBridge.connected()) {
            this.mqttService.publish(ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC, { from: ieeeAddress, to: newFriendlyName });
        }
    }

    removeZigbeeDevice(ieeeAddress: string, force = false): void {
        if (ZigbeeBridge.connected()) {
            this.mqttService.publish(ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, { id: ieeeAddress, force });
        }
    }

    async handleDeviceExternalRename(oldFriendlyName: string, newFriendlyName: string): Promise<void> {
        if (oldFriendlyName !== newFriendlyName) {
            this.eventEmitter.emit(
                DeviceUpdateRequestedEvent.eventName,
                new DeviceUpdateRequestedEvent(
                    { zigbeeFriendlyName: oldFriendlyName },
                    new UpdateDeviceDto({ zigbeeFriendlyName: newFriendlyName }),
                ),
            );
        }
    }

    async handleDeviceStateUpdate(zigbeeFriendlyName: string, state: Record<string, unknown>): Promise<void> {
        try {
            const device = await this.devicesService.getDeviceByZigbeeFriendlyName(zigbeeFriendlyName);
            if (!device) {
                this.logger.debug(`No device found with Zigbee friendly name "${zigbeeFriendlyName}", ignoring state update`);
                return;
            }

            const { commands, controls, measurements } = await this.deviceConfigsMapper.categorizeAndMapPayloadFromDevice(device, state);

            if (Object.keys(commands).length) {
                // TODO: Decouple by emitting DeviceCommandRequestedEvent.
                //  The command payload will be handled and validated in DevicesService and DeviceCommandExecutedEvent fired after
                await this.devicesService.sendCommand(device.externalId, commands);
            }

            const hasControls = Object.keys(controls).length > 0;
            const hasMeasurements = Object.keys(measurements).length > 0;

            if (hasControls || hasMeasurements) {
                this.eventEmitter.emit(
                    DeviceUpdateRequestedEvent.eventName,
                    new DeviceUpdateRequestedEvent(
                        { externalId: device.externalId },
                        new UpdateDeviceDto({
                            ...(hasControls && { controls }),
                            ...(hasMeasurements && { measurements }),
                        }),
                    ),
                );
                this.logger.debug(`Updated Zigbee device "${zigbeeFriendlyName}" state`);
            }
        } catch (error) {
            this.logger.error(`Error while processing Zigbee device state for "${zigbeeFriendlyName}"`);
            this.logger.error(error);
        }
    }
}
