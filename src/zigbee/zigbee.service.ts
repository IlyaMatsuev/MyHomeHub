import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { MqttService } from 'mqtt/mqtt.service';
import { ZigbeeDevice, PairableDevice } from 'zigbee/interfaces';
import { UpdateDeviceDto } from 'devices/dto';
import { DevicesService } from 'devices/devices.service';
import { DeviceControls, DevicePayload } from 'devices/interfaces';
import {
    Z2M_SUPPORTED_CONTROLS,
    Z2M_SUPPORTED_MEASUREMENTS,
    ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC,
    ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC,
    ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC,
} from 'zigbee/zigbee.constants';

@Injectable()
export class ZigbeeService {
    private readonly logger = new Logger(ZigbeeService.name);

    private static pairableDevices: Map<string, PairableDevice> = new Map<string, PairableDevice>();

    constructor(
        private readonly mqttService: MqttService,
        @Inject(forwardRef(() => DevicesService))
        private readonly devicesService: DevicesService,
    ) {}

    hasPairableDevice(ieeeAddress: string): boolean {
        return ZigbeeService.pairableDevices.has(ieeeAddress);
    }

    getPairableDevice(ieeeAddress: string): PairableDevice | null {
        return ZigbeeService.pairableDevices.get(ieeeAddress) || null;
    }

    getPairableDevices(): Array<PairableDevice> {
        return Array.from(ZigbeeService.pairableDevices.values());
    }

    savePairableDevices(zigbeeDevices: Array<ZigbeeDevice>): void {
        const eligibleZigbeeDevices: Array<[string, PairableDevice]> = zigbeeDevices
            .filter(
                zd =>
                    // "Coordinator" is a zigbee dongle itself
                    zd.type !== 'Coordinator' &&
                    zd.supported &&
                    !zd.disabled &&
                    zd.interview_completed &&
                    zd.interview_state === 'SUCCESSFUL',
            )
            .map(zd => [
                zd.ieee_address,
                {
                    zigbeeIeeeAddress: zd.ieee_address,
                    zigbeeFriendlyName: zd.friendly_name,
                },
            ]);
        ZigbeeService.pairableDevices = new Map<string, PairableDevice>(eligibleZigbeeDevices);
    }

    setPermitJoin(enable: boolean, seconds: number): void {
        const payload: { value: boolean; time?: number } = { value: enable };
        if (seconds !== undefined) {
            payload.time = seconds;
        }
        this.mqttService.publish(ZIGBEE_BRIDGE_PERMIT_JOIN_TOPIC, payload);
    }

    async renameDevice(ieeeAddress: string, newFriendlyName: string): Promise<void> {
        this.mqttService.publish(ZIGBEE_BRIDGE_DEVICE_RENAME_TOPIC, { from: ieeeAddress, to: newFriendlyName });
    }

    async removeZigbeeDevice(ieeeAddress: string, force = false): Promise<void> {
        this.mqttService.publish(ZIGBEE_BRIDGE_DEVICE_REMOVE_TOPIC, { id: ieeeAddress, force });
    }

    async updateDeviceState(zigbeeFriendlyName: string, state: Record<string, unknown>): Promise<void> {
        try {
            const device = await this.devicesService.getDevice({ zigbeeFriendlyName }, { strict: false });
            if (!device) {
                this.logger.debug(`No device found with Zigbee friendly name "${zigbeeFriendlyName}", ignoring state update`);
                return;
            }

            const { controls, measurements } = this.mapZigbeeState(state);

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
    private mapZigbeeState(z2mPayload: Record<string, unknown>): { controls: DeviceControls; measurements: DevicePayload } {
        const controls: DevicePayload = {};
        const measurements: DevicePayload = {};

        for (const [key, value] of Object.entries(z2mPayload)) {
            if (Z2M_SUPPORTED_CONTROLS.has(key)) {
                controls[key] = value;
            } else if (Z2M_SUPPORTED_MEASUREMENTS.has(key)) {
                measurements[key] = value;
            }
        }

        return { controls, measurements };
    }
}
