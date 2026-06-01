import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Model, RootFilterQuery } from 'mongoose';
import { DevicesControlServiceFactory } from 'devices-control/devices-control-service.factory';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { Device, DeviceFilter, GetDeviceOptions, PairingModeStatus } from 'devices/interfaces';
import { GetDevicesDto, CreateDeviceDto, UpdateDeviceDto, GetPairableDevicesDto, DevicePayloadDto } from 'devices/dto';
import { DeviceUpdateRequestedEvent, DeviceUpdateCompletedEvent, DeviceCommandExecutedEvent } from 'devices/events';
import { DEVICE_MODEL_PROVIDER_NAME, GET_ALL_DEVICES_PAGE_SIZE } from 'devices/devices.constants';
import { ZigbeeService } from 'zigbee/zigbee.service';
import { PairableDevice } from 'zigbee/interfaces';
import { ZigbeePairableDevices } from 'zigbee/store';
import { PaginationResponseDto } from 'common/dto';

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
    ) {}

    @OnEvent(DeviceUpdateRequestedEvent.eventName)
    async onDeviceUpdated(event: DeviceUpdateRequestedEvent): Promise<void> {
        this.logger.debug(`[${DeviceUpdateRequestedEvent.eventName}] Event: ${JSON.stringify(event)}`);

        const device = await this.getDevice(event.selector, { strict: false });
        if (device) {
            await this.updateDevice(device.externalId, event.update);
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

        return new PaginationResponseDto(devices, options.page, options.pageSize, total);
    }

    async getAllDevices(filter: DeviceFilter = {}): Promise<PaginationResponseDto<Device>> {
        const options = new GetDevicesDto();
        options.pageSize = GET_ALL_DEVICES_PAGE_SIZE;

        const firstPage = await this.getDevices(filter, options);
        const allDevices: Array<Device> = [...firstPage.items];

        if (firstPage.totalPages > 1) {
            const remainingPages = Array.from({ length: firstPage.totalPages - 1 }, (_, i) => i + 2);
            const pagePromises = remainingPages.map(pageNum => {
                const pageOptions = new GetDevicesDto();
                pageOptions.page = pageNum;
                pageOptions.pageSize = GET_ALL_DEVICES_PAGE_SIZE;
                return this.getDevices(filter, pageOptions);
            });
            const pages = await Promise.all(pagePromises);
            for (const page of pages) {
                allDevices.push(...page.items);
            }
        }

        return new PaginationResponseDto(allDevices, 1, allDevices.length, allDevices.length);
    }

    getDeviceByExternalId(externalId: string, options: GetDeviceOptions = { strict: true }): Promise<Device> {
        return this.getDevice({ externalId }, options);
    }

    getDeviceByIp(ip: string): Promise<Device> {
        return this.getDevice({ ip }, { strict: false });
    }

    getDeviceByZigbeeFriendlyName(friendlyName: string): Promise<Device> {
        return this.getDevice({ zigbeeFriendlyName: friendlyName }, { strict: false });
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
        if (deviceDto.zigbeeIeeeAddress && !ZigbeePairableDevices.has(deviceDto.zigbeeIeeeAddress)) {
            throw new BadRequestException(
                `Device with the provided zigbee Ieee ('${deviceDto.zigbeeIeeeAddress}') is not discoverable. Make sure it's pairable first`,
            );
        }

        const newDevice = await this.assignDtoValues(new this.deviceModel(deviceDto), deviceDto);

        await newDevice.save({ validateBeforeSave: true });

        if (newDevice.zigbeeFriendlyName) {
            this.zigbeeService.renameDevice(newDevice.zigbeeIeeeAddress, newDevice.zigbeeFriendlyName);
        }
        return newDevice;
    }

    async updateDevice(externalId: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        const updatedDevice = await this.assignDtoValues(device, updateDeviceDto);

        if (updateDeviceDto.controlsUpdated) {
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

    toggleDevicePairingMode(enable: boolean, timeout: number): PairingModeStatus {
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

    private async assignDtoValues(device: Device, updatedDevice: CreateDeviceDto | UpdateDeviceDto): Promise<Device> {
        const controlService = this.getControlService(device);
        for (const field of Object.keys(updatedDevice)) {
            if (field === 'controls') {
                device.controls = await controlService.mergeValidateControls(updatedDevice.controls, device.controls);
            } else if (field === 'measurements') {
                // TODO: Do I need to validate them?
                device.measurements = updatedDevice.measurements;
            } else {
                device[field] = updatedDevice[field];
            }
        }
        return device;
    }
}
