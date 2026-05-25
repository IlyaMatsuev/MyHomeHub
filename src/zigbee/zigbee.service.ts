import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { MqttService } from 'mqtt/mqtt.service';
import { UpdateDeviceDto } from 'devices/dto';
import { DevicesService } from 'devices/devices.service';
import { DeviceControls, DevicePayload } from 'devices/interfaces';
import {
    Z2M_SUPPORTED_COMMANDS,
    Z2M_SUPPORTED_CONTROLS,
    Z2M_SUPPORTED_MEASUREMENTS,
    ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC,
    ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC,
    ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC,
} from 'zigbee/zigbee.constants';
import { ZigbeeBridge } from 'zigbee/store/zigbee-bridge';

@Injectable()
export class ZigbeeService {
    private readonly logger = new Logger(ZigbeeService.name);

    constructor(
        private readonly mqttService: MqttService,
        @Inject(forwardRef(() => DevicesService))
        private readonly devicesService: DevicesService,
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
        const device = await this.devicesService.getDeviceByZigbeeFriendlyName(oldFriendlyName);
        if (!device) {
            this.logger.warn(`No device found to rename with Zigbee friendly name "${oldFriendlyName}". Updated to "${newFriendlyName}"`);
            return;
        }

        if (oldFriendlyName !== newFriendlyName) {
            await this.devicesService.updateDevice(
                device.externalId,
                new UpdateDeviceDto({ zigbeeFriendlyName: newFriendlyName ?? device.zigbeeIeeeAddress }),
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

            const { commands, controls, measurements } = this.mapZigbeeState(state);

            if (Object.keys(commands).length > 0) {
                await this.devicesService.sendCommand(device.externalId, commands);
            }

            const hasControls = Object.keys(controls).length > 0;
            const hasMeasurements = Object.keys(measurements).length > 0;

            if (hasControls || hasMeasurements) {
                await this.devicesService.updateDevice(
                    device.externalId,
                    new UpdateDeviceDto({
                        ...(hasControls && { controls }),
                        ...(hasMeasurements && { measurements }),
                    }),
                );
                this.logger.debug(`Updated Zigbee device "${zigbeeFriendlyName}" state`);
            }
        } catch (error) {
            this.logger.error(`Error while processing Zigbee device state for "${zigbeeFriendlyName}"`);
            this.logger.error(error);
        }
    }

    // TODO: Need to find a better way to map z2m values based on device
    private mapZigbeeState(z2mPayload: Record<string, unknown>): {
        commands: DevicePayload;
        controls: DeviceControls;
        measurements: DevicePayload;
    } {
        const commands: DevicePayload = {};
        const controls: DevicePayload = {};
        const measurements: DevicePayload = {};

        for (const [key, value] of Object.entries(z2mPayload)) {
            if (Z2M_SUPPORTED_COMMANDS.has(key)) {
                commands[key] = value;
            } else if (Z2M_SUPPORTED_CONTROLS.has(key)) {
                controls[key] = value;
            } else if (Z2M_SUPPORTED_MEASUREMENTS.has(key)) {
                measurements[key] = value;
            }
        }

        return { commands, controls, measurements };
    }
}
