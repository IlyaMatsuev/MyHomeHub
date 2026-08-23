import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Model, RootFilterQuery } from 'mongoose';
import { DevicesControlServiceFactory } from 'devices-control/devices-control-service.factory';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { Device, DeviceFilter, GetDeviceOptions, UpdateDeviceOptions } from 'devices/interfaces';
import {
    GetDevicesDto,
    GetDeviceDto,
    CreateDeviceDto,
    UpdateDeviceDto,
    GetPairableDevicesDto,
    DevicePayloadDto,
    PairingModeStatusResponseDto,
    DeviceResponseDto,
} from 'devices/dto';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { DEVICE_CONFIG_SECTIONS, DeviceConfigKey, DeviceConfigSection } from 'device-configs/interfaces';
import { DeviceConfigResponseDto } from 'device-configs/dto';
import { DeviceUpdateRequestedEvent, DeviceUpdateCompletedEvent, DeviceCommandExecutedEvent } from 'devices/events';
import { DEVICE_MODEL_PROVIDER_NAME } from 'devices/devices.constants';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { PairableDevice } from 'zigbee/interfaces';
import { ZigbeePairableDevices } from 'zigbee/store';
import { PaginationResponseDto } from 'common/dto';
import { MAX_PAGE_SIZE } from 'common/common.constants';
import { FieldValidationException } from 'common/exceptions';

@Injectable()
export class DevicesService {
    private readonly logger = new Logger(DevicesService.name);

    constructor(
        @Inject(DEVICE_MODEL_PROVIDER_NAME)
        private readonly deviceModel: Model<Device>,
        @Inject(DEVICES_CONTROL_FACTORY_PROVIDER)
        private readonly deviceControlServiceFactory: DevicesControlServiceFactory,
        private readonly eventEmitter: EventEmitter2,
        @Inject(forwardRef(() => ZigbeeService))
        private readonly zigbeeService: ZigbeeService,
        private readonly deviceConfigsService: DeviceConfigsService,
    ) {}

    @OnEvent(DeviceUpdateRequestedEvent.eventName)
    async onDeviceUpdated(event: DeviceUpdateRequestedEvent): Promise<void> {
        this.logger.debug(`[${DeviceUpdateRequestedEvent.eventName}] Event: ${JSON.stringify(event)}`);

        const device = await this.findDevice(event.selector, { strict: false });
        if (device) {
            await this.updateDevice(device.externalId, event.update, { propagateControls: event.propagate });
        } else {
            this.logger.warn(`No device matched DeviceUpdatedEvent selector ${JSON.stringify(event.selector)}`);
        }
    }

    getControlService(device: Device): DevicesControlService {
        return this.deviceControlServiceFactory.getControlService(device);
    }

    async getDevices(filter: DeviceFilter = {}, options: GetDevicesDto = new GetDevicesDto()): Promise<PaginationResponseDto<Device>> {
        const conditions: RootFilterQuery<Device> = { ...filter };
        if (options.room) {
            conditions.room = options.room;
        }

        const [devices, total] = await Promise.all([
            this.deviceModel.find(conditions).skip(options.skipRecords).limit(options.pageSize).lean(),
            this.deviceModel.countDocuments(conditions),
        ]);
        const items = options.includeConfig ? await this.attachDeviceConfigs(devices) : devices;

        return new PaginationResponseDto(items, options.page, options.pageSize, total);
    }

    async getAllDevices(filter: DeviceFilter = {}): Promise<PaginationResponseDto<Device>> {
        const firstPage = await this.getDevices(filter, new GetDevicesDto({ pageSize: MAX_PAGE_SIZE }));
        const allDevices: Array<Device> = [...firstPage.items];

        if (firstPage.totalPages > 1) {
            const remainingPages = Array.from({ length: firstPage.totalPages - 1 }, (_, i) => i + 2);
            const pagePromises = remainingPages.map(pageNum => {
                return this.getDevices(filter, new GetDevicesDto({ page: pageNum, pageSize: MAX_PAGE_SIZE }));
            });
            for (const page of await Promise.all(pagePromises)) {
                allDevices.push(...page.items);
            }
        }

        return new PaginationResponseDto(allDevices, 1, allDevices.length, allDevices.length);
    }

    getDeviceByExternalId(externalId: string, options: GetDeviceOptions = { strict: true }): Promise<Device> {
        return this.findDevice({ externalId }, options);
    }

    async getDevice(externalId: string, options: GetDeviceDto = new GetDeviceDto()): Promise<DeviceResponseDto> {
        const device = await this.getDeviceByExternalId(externalId);
        if (!options.includeConfig) {
            return device;
        }
        const config = await this.deviceConfigsService.getConfig(this.getDeviceConfigKey(device));
        return { ...device.toObject(), config: DeviceConfigResponseDto.fromConfig(config) };
    }

    getDeviceByIp(ip: string): Promise<Device> {
        return this.findDevice({ ip }, { strict: false });
    }

    getDeviceByZigbeeFriendlyName(friendlyName: string): Promise<Device> {
        return this.findDevice({ zigbeeFriendlyName: friendlyName }, { strict: false });
    }

    async addDevice(deviceDto: CreateDeviceDto): Promise<DeviceResponseDto> {
        const existingDevice = await this.findDevice({ name: deviceDto.name }, { strict: false });
        if (existingDevice) {
            throw new FieldValidationException(`Device with the same name ('${deviceDto.name}') already exists`, 'name');
        }
        if (deviceDto.zigbeeIeeeAddress && !ZigbeePairableDevices.has(deviceDto.zigbeeIeeeAddress)) {
            throw new FieldValidationException(
                `Device with the provided zigbee Ieee ('${deviceDto.zigbeeIeeeAddress}') is not discoverable. Make sure it's pairable first`,
                'zigbeeIeeeAddress',
            );
        }

        const newDevice = await this.assignDtoValues(new this.deviceModel(deviceDto), deviceDto);

        await newDevice.save({ validateBeforeSave: true });

        if (newDevice.zigbeeFriendlyName) {
            this.zigbeeService.renameDevice(newDevice.zigbeeIeeeAddress, newDevice.zigbeeFriendlyName);
        }
        return newDevice;
    }

    async updateDevice(
        externalId: string,
        updateDeviceDto: UpdateDeviceDto,
        options: UpdateDeviceOptions = { propagateControls: true },
    ): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        const updatedDevice = await this.assignDtoValues(device, updateDeviceDto);

        if (updateDeviceDto.controlsUpdated && options.propagateControls) {
            await this.getControlService(updatedDevice).setControls(updatedDevice.controls);
        }

        await updatedDevice.save({ validateBeforeSave: true });

        if (device.zigbeeIeeeAddress) {
            const oldZigbeeFriendlyName = ZigbeePairableDevices.get(device.zigbeeIeeeAddress)?.zigbeeFriendlyName;
            if (oldZigbeeFriendlyName !== updatedDevice.zigbeeFriendlyName) {
                this.zigbeeService.renameDevice(updatedDevice.zigbeeIeeeAddress, updatedDevice.zigbeeFriendlyName);
            }
        }

        this.eventEmitter.emit(
            DeviceUpdateCompletedEvent.eventName,
            new DeviceUpdateCompletedEvent(externalId, updateDeviceDto.controlsUpdated, updateDeviceDto.measurementsUpdated),
        );
        return updatedDevice;
    }

    async sendCommand(externalId: string, command: DevicePayloadDto): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        const controlService = this.getControlService(device);
        const validatedCommand = await controlService.validateControls(command);
        await controlService.setControls(validatedCommand);
        this.eventEmitter.emit(DeviceCommandExecutedEvent.eventName, new DeviceCommandExecutedEvent(externalId, validatedCommand));
        return device;
    }

    async removeDevice(externalId: string): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        await this.deviceModel.deleteOne({ _id: device._id }).exec();
        if (device.zigbeeIeeeAddress) {
            this.zigbeeService.removeZigbeeDevice(device.zigbeeIeeeAddress);
        }
        return device;
    }

    toggleDevicePairingMode(enable: boolean, timeout: number): PairingModeStatusResponseDto {
        this.zigbeeService.setPermitJoin(enable, timeout);
        return { enabled: enable, timeout: enable ? timeout : 0 };
    }

    async getPairableDevices(options: GetPairableDevicesDto = new GetPairableDevicesDto()): Promise<PaginationResponseDto<PairableDevice>> {
        const cachedZigbeeDevices = ZigbeePairableDevices.getAll();

        if (!cachedZigbeeDevices.length) {
            return new PaginationResponseDto([], options.page, options.pageSize, 0);
        }

        const zigbeeDeviceIds = cachedZigbeeDevices.map(d => d.zigbeeIeeeAddress);
        const existingZigbeeDevices = await this.deviceModel
            .find({ zigbeeIeeeAddress: { $in: zigbeeDeviceIds } }, { zigbeeIeeeAddress: 1 })
            .lean();
        const existingZigbeeDevicesIds = new Set(existingZigbeeDevices.map(d => d.zigbeeIeeeAddress));

        const pairableDevices = cachedZigbeeDevices.filter(d => !existingZigbeeDevicesIds.has(d.zigbeeIeeeAddress));

        return new PaginationResponseDto(pairableDevices, options.page, options.pageSize);
    }

    private async findDevice(filter: DeviceFilter, options: GetDeviceOptions = { strict: true }): Promise<DeviceResponseDto> {
        const device = await this.deviceModel.findOne(filter).exec();
        if (!device && options.strict) {
            throw new NotFoundException('There is no device matching these criteria');
        }
        return device;
    }

    private async attachDeviceConfigs(devices: Array<Device>): Promise<Array<Device>> {
        const keysByHash = new Map<string, DeviceConfigKey>();
        for (const device of devices) {
            const key = this.getDeviceConfigKey(device);
            keysByHash.set(this.hashDeviceConfigKey(key), key);
        }

        const configs = await this.deviceConfigsService.getConfigs([...keysByHash.values()]);
        const configsByHash = new Map(
            configs.map(config => [this.hashDeviceConfigKey(config), DeviceConfigResponseDto.fromConfig(config)]),
        );

        return devices.map(device => {
            const config = configsByHash.get(this.hashDeviceConfigKey(this.getDeviceConfigKey(device)));
            return config ? { ...device, config } : device;
        });
    }

    private getDeviceConfigKey(device: Device): DeviceConfigKey {
        return { brand: device.brand, type: device.type, transportProtocol: device.transportProtocol };
    }

    private hashDeviceConfigKey(key: DeviceConfigKey): string {
        return `${key.brand}:${key.type}:${key.transportProtocol}`;
    }

    private async assignDtoValues(device: Device, updatedDevice: CreateDeviceDto | UpdateDeviceDto): Promise<Device> {
        const fields = Object.keys(updatedDevice);
        for (const field of fields.filter(field => !DEVICE_CONFIG_SECTIONS.includes(field as DeviceConfigSection))) {
            device[field] = updatedDevice[field];
        }

        // Assign controls and measurements last to choose a correct control service in case device config keys have been changed on the device (brand/protocol)
        if (fields.includes('controls')) {
            device.controls = await this.getControlService(device).mergeValidateControls(updatedDevice.controls, device.controls);
        }
        if (fields.includes('measurements')) {
            device.measurements = await this.getControlService(device).mergeValidateMeasurements(
                updatedDevice.measurements,
                device.measurements,
            );
        }
        return device;
    }
}
