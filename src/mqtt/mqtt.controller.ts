import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { MqttService } from 'mqtt/mqtt.service';
import {
    CONTROLS_SYNC_TOPIC_NAME,
    DEVICE_PAIR_REQUEST_TOPIC_NAME,
    MEASUREMENTS_UPDATE_TOPIC_NAME,
    MQTT_TOPIC_PARTS_SEPARATOR,
    MQTT_TOPIC_PARTS_WILDCARD,
    ZIGBEE_BRIDGE_DEVICES_TOPIC,
    ZIGBEE_DEVICE_STATE_TOPIC,
} from 'mqtt/mqtt.constants';
import { DevicesService } from 'devices/devices.service';
import { PairRequestDto } from 'mqtt/dto';
import { DeviceControlsDto, DevicePayloadDto, UpdateDeviceDto } from 'devices/dto';
import { plainToInstance } from 'class-transformer';
import { ZigbeeStateMapperService } from 'mqtt/zigbee-state-mapper.service';
import { ZigbeeDevice } from 'mqtt/interfaces';

@Controller()
export class MqttController {
    private readonly logger = new Logger(MqttController.name);

    constructor(
        private readonly mqttService: MqttService,
        private readonly devicesService: DevicesService,
        private readonly zigbeeStateMapper: ZigbeeStateMapperService,
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
    async onHomeControlsSync(@Ctx() context: MqttContext, @Payload('controls') controls: DeviceControlsDto): Promise<void> {
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

    @MessagePattern(ZIGBEE_BRIDGE_DEVICES_TOPIC)
    async onZigbeeDevicesChange(@Ctx() context: MqttContext, @Payload() devices: Array<ZigbeeDevice>): Promise<void> {
        this.logger.debug(`Received a list of devices on "${context.getTopic()}": ${JSON.stringify(devices)}`);
        await this.devicesService.savePairableDevices(devices ?? []);
    }

    // TODO: Review the logic closely
    @MessagePattern(ZIGBEE_DEVICE_STATE_TOPIC)
    async onZigbeeDeviceStateChange(@Ctx() context: MqttContext, @Payload() state: Record<string, unknown>): Promise<void> {
        this.logger.debug(`Received Zigbee state for "${context.getTopic()}": ${JSON.stringify(state)}`);

        const [friendlyName] = this.extractTopicWildcards(ZIGBEE_DEVICE_STATE_TOPIC, context.getTopic());

        if (friendlyName === 'bridge' || friendlyName.startsWith('bridge/')) {
            this.logger.debug(`Bridge state update, skipping`);
            return;
        }

        try {
            const device = await this.devicesService.getDevice({ zigbeeFriendlyName: friendlyName }, { strict: false });
            if (!device) {
                this.logger.debug(`No device found with Zigbee friendly name "${friendlyName}", ignoring state update`);
                return;
            }

            const { controls, measurements } = this.zigbeeStateMapper.mapState(state);

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
                this.logger.debug(`Updated Zigbee device "${friendlyName}" state`);
            }
        } catch (error) {
            this.logger.error(`Error while processing Zigbee device state for "${friendlyName}"`);
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
