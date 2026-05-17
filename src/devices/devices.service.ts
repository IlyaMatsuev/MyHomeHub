import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { DevicesControlServiceFactory } from 'devices-control/devices-control-service.factory';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import {
    Device,
    DeviceFilter,
    DevicesPage,
    GetDeviceOptions,
    PairableDevice,
    PairableDevicesPage,
    PairingModeStatus,
} from 'devices/interfaces';
import { GetDevicesDto, CreateDeviceDto, UpdateDeviceDto, GetPairableDevicesDto } from 'devices/dto';
import { DeviceControlsUpdatedEvent, DeviceMeasurementsUpdatedEvent } from 'devices/events';
import { DEVICE_MODEL_PROVIDER_NAME } from 'devices/devices.constants';
import { MqttService } from 'mqtt/mqtt.service';
import { ZigbeeDevice } from 'mqtt/interfaces';

@Injectable()
export class DevicesService {
    // TODO: Probably move this somewhere to ZigbeeService or something
    private static pairableDevices: Map<string, PairableDevice> = new Map<string, PairableDevice>();

    constructor(
        @Inject(DEVICE_MODEL_PROVIDER_NAME)
        private readonly deviceModel: Model<Device>,
        @Inject(DEVICES_CONTROL_FACTORY_PROVIDER)
        private readonly deviceControlServiceFactory: DevicesControlServiceFactory,
        private readonly eventEmitter: EventEmitter2,
        private readonly mqttService: MqttService,
    ) {}

    getControlService(device: Device): DevicesControlService {
        return this.deviceControlServiceFactory.getControlService(device);
    }

    async getDevices(options: GetDevicesDto = new GetDevicesDto()): Promise<DevicesPage> {
        const [devices, total] = await Promise.all([
            this.deviceModel.find().skip(options.skipRecords).limit(options.pageSize).lean(),
            this.deviceModel.countDocuments(),
        ]);

        return {
            devices,
            page: options.page,
            pageSize: options.pageSize,
            totalPages: Math.ceil(total / options.pageSize),
        };
    }

    getDeviceByExternalId(externalId: string, options: GetDeviceOptions = { strict: true }): Promise<Device> {
        return this.getDevice({ externalId }, options);
    }

    getDeviceByIp(ip: string, options: GetDeviceOptions = { strict: true }): Promise<Device> {
        return this.getDevice({ ip }, options);
    }

    async getDevice(filter: DeviceFilter, options: GetDeviceOptions = { strict: true }): Promise<Device> {
        const device = await this.deviceModel.findOne(filter).exec();
        if (!device && options.strict) {
            throw new NotFoundException('There is no device matching these criteria');
        }
        return device;
    }

    async addDevice(deviceDto: CreateDeviceDto): Promise<Device> {
        const existingDevice = await this.getDevice({ name: deviceDto.name }, { strict: false });
        if (existingDevice) {
            throw new BadRequestException(`Device with the same name ('${deviceDto.name}') already exists`);
        }
        if (deviceDto.zigbeeIeeeAddress && !DevicesService.pairableDevices.has(deviceDto.zigbeeIeeeAddress)) {
            throw new BadRequestException(
                `Device with the provided zigbee Ieee ('${deviceDto.zigbeeIeeeAddress}') is not discoverable. Make sure it's pairable first`,
            );
        }

        const newDevice = await this.assignDtoValues(new this.deviceModel(deviceDto), deviceDto);
        if (newDevice.zigbeeFriendlyName) {
            await this.mqttService.renameZigbeeDevice(newDevice.zigbeeIeeeAddress, newDevice.zigbeeFriendlyName);
        }
        return newDevice;
    }

    async updateDevice(externalId: string, updateDeviceInfoDto: UpdateDeviceDto): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        if (device.zigbeeIeeeAddress !== updateDeviceInfoDto.zigbeeIeeeAddress) {
            throw new BadRequestException(`Zigbee Ieee address cannot be changed, add a new device instead`);
        }

        const updatedDevice = await this.assignDtoValues(device, updateDeviceInfoDto);
        if (updateDeviceInfoDto.controlsUpdated) {
            this.eventEmitter.emit(
                DeviceControlsUpdatedEvent.eventName,
                new DeviceControlsUpdatedEvent(externalId, updatedDevice.controls),
            );
        }
        if (updateDeviceInfoDto.measurementsUpdated) {
            this.eventEmitter.emit(DeviceMeasurementsUpdatedEvent.eventName, new DeviceMeasurementsUpdatedEvent(externalId));
        }

        if (device.zigbeeIeeeAddress) {
            const oldZigbeeFriendlyName = DevicesService.pairableDevices.get(device.zigbeeIeeeAddress).zigbeeFriendlyName;
            if (oldZigbeeFriendlyName !== updatedDevice.zigbeeFriendlyName) {
                await this.mqttService.renameZigbeeDevice(updatedDevice.zigbeeIeeeAddress, updatedDevice.zigbeeFriendlyName);
            }
        }
        return updatedDevice;
    }

    async removeDevice(externalId: string): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        await this.deviceModel.deleteOne({ _id: device._id }).exec();
        if (device.zigbeeIeeeAddress) {
            await this.mqttService.removeZigbeeDevice(device.zigbeeIeeeAddress);
        }
        return device;
    }

    async toggleDevicePairingMode(enable: boolean, timeout: number): Promise<PairingModeStatus> {
        await this.mqttService.setZigbeePermitJoin(enable, timeout);
        return { enabled: enable, timeout: enable ? timeout : 0 };
    }

    async getPairableDevices(options: GetPairableDevicesDto = new GetPairableDevicesDto()): Promise<PairableDevicesPage> {
        const cachedZigbeeDevices = Array.from(DevicesService.pairableDevices.values());

        if (!cachedZigbeeDevices.length) {
            return { devices: [], page: options.page, pageSize: options.pageSize, totalPages: 0 };
        }

        const zigbeeDeviceIds = cachedZigbeeDevices.map(d => d.zigbeeIeeeAddress);
        const existingZigbeeDevices = await this.deviceModel
            .find({ zigbeeIeeeAddress: { $in: zigbeeDeviceIds } }, { zigbeeIeeeAddress: 1 })
            .lean();
        const existingZigbeeDevicesIds = new Set(existingZigbeeDevices.map(d => d.zigbeeIeeeAddress));

        const pairableDevices = cachedZigbeeDevices.filter(d => !existingZigbeeDevicesIds.has(d.zigbeeIeeeAddress));

        return {
            devices: pairableDevices.slice(options.skipRecords, options.skipRecords + options.pageSize),
            page: options.page,
            pageSize: options.pageSize,
            totalPages: Math.ceil(pairableDevices.length / options.pageSize),
        };
    }

    async savePairableDevices(zigbeeDevices: Array<ZigbeeDevice>): Promise<void> {
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
        DevicesService.pairableDevices = new Map<string, PairableDevice>(eligibleZigbeeDevices);
    }

    private async assignDtoValues(device: Device, updatedDevice: CreateDeviceDto | UpdateDeviceDto): Promise<Device> {
        const controlService = this.getControlService(device);
        for (const field of Object.keys(updatedDevice)) {
            if (field === 'controls') {
                device.controls = await controlService.mergeValidateControls(updatedDevice.controls, device.controls);
            } else {
                device[field] = updatedDevice[field];
            }
        }
        return device.save({ validateBeforeSave: true });
    }
}
