import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Model, RootFilterQuery } from 'mongoose';
import { DevicesControlServiceFactory } from 'devices-control/devices-control-service.factory';
import { DevicesControlService } from 'devices-control/devices-control.service';
import { DEVICES_CONTROL_FACTORY_PROVIDER } from 'devices-control/devices-control.constants';
import { Device, DeviceFilter, DeviceUpdateOrigin, AddDeviceOptions, GetDeviceOptions, UpdateDeviceOptions } from 'devices/interfaces';
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
import {
    DEVICE_CONFIG_SECTIONS,
    DEVICE_CONFIG_PAYLOADS_SECTIONS,
    DeviceConfigItem,
    DeviceConfigKey,
    DeviceConfigSection,
    DeviceConfigValidationPolicy,
    ParsedDeviceConfig,
} from 'device-configs/interfaces';
import { DeviceConfigsChangedEvent } from 'device-configs/events';
import { getItemDefaultValue } from 'device-configs/validators';
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
            await this.updateDevice(device.externalId, event.update, { propagateControls: event.propagate, origin: event.origin });
        } else {
            this.logger.warn(`No device matched DeviceUpdatedEvent selector ${JSON.stringify(event.selector)}`);
        }
    }

    /**
     * Keeps the stored controls/measurements in sync with the device configs from the .yaml
     * Newly declared items are initialized with their defaults, and the ones no longer declared are removed
     */
    @OnEvent(DeviceConfigsChangedEvent.eventName)
    async onDeviceConfigsChanged(event: DeviceConfigsChangedEvent): Promise<void> {
        await this.reconcileDeviceConfigs(event.configs);
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

    async addDevice(
        deviceDto: CreateDeviceDto,
        options: AddDeviceOptions = { origin: DeviceUpdateOrigin.Api },
    ): Promise<DeviceResponseDto> {
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

        const newDevice = await this.assignDtoValues(new this.deviceModel(deviceDto), deviceDto, options.origin);
        await this.getControlService(newDevice).applyConfigDefaults();

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
        const configKeyChanged = this.isDeviceConfigKeyChanged(device, updateDeviceDto);
        const updatedDevice = await this.assignDtoValues(device, updateDeviceDto, options.origin);
        if (configKeyChanged) {
            await this.getControlService(updatedDevice).applyConfigDefaults();
        }

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

    async sendCommand(
        externalId: string,
        command: DevicePayloadDto,
        options: AddDeviceOptions = { origin: DeviceUpdateOrigin.Api },
    ): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        const controlService = this.getControlService(device);
        const validatedCommand = await controlService.validateCommand(command, this.buildValidationPolicy(options.origin));
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

    private async reconcileDeviceConfigs(configs: Array<ParsedDeviceConfig>): Promise<void> {
        for (const config of configs) {
            await this.reconcileDevicePayloads(config);
        }
    }

    private async reconcileDevicePayloads(config: ParsedDeviceConfig): Promise<void> {
        const filter = { brand: config.brand, type: config.type, transportProtocol: config.transportProtocol };
        const devices = await this.deviceModel.find(filter, { controls: 1, measurements: 1 }).lean<Array<Device>>();
        const operations = devices.map(device => this.buildPayloadsReconcileOperation(config, device)).filter(operation => operation);

        if (operations.length) {
            await this.deviceModel.bulkWrite(operations);
            this.logger.log(`Reconciled the payloads of ${operations.length} "${config.brand}/${config.type}" device(s)`);
        }
    }

    private buildPayloadsReconcileOperation(config: ParsedDeviceConfig, device: Device) {
        const setFields: Record<string, unknown> = {};
        const unsetFields: Record<string, string> = {};

        for (const section of DEVICE_CONFIG_PAYLOADS_SECTIONS) {
            const configItems: Array<DeviceConfigItem> = config[section] ?? [];
            if (!configItems.length) {
                // No controls/measurements present, so the stored payload is left untouched
                continue;
            }

            const storedPayload = device[section] ?? {};

            // Config fields that are not present in the device's payload - set default
            for (const item of configItems.filter(i => !(i.name in storedPayload))) {
                setFields[`${section}.${item.name}`] = getItemDefaultValue(item);
            }

            // Stored fields the config no longer declares - remove
            for (const name of Object.keys(storedPayload).filter(n => !configItems.some(i => i.name === n))) {
                unsetFields[`${section}.${name}`] = '';
            }
        }

        const update = {
            ...(Object.keys(setFields).length && { $set: setFields }),
            ...(Object.keys(unsetFields).length && { $unset: unsetFields }),
        };
        return Object.keys(update).length ? { updateOne: { filter: { _id: device._id }, update } } : null;
    }

    private isDeviceConfigKeyChanged(device: Device, updateDeviceDto: UpdateDeviceDto): boolean {
        const changedKeyFields: Array<keyof DeviceConfigKey> = ['brand', 'type', 'transportProtocol'];
        return changedKeyFields.some(field => updateDeviceDto[field] !== undefined && updateDeviceDto[field] !== device[field]);
    }

    private async assignDtoValues(
        device: Device,
        updatedDevice: CreateDeviceDto | UpdateDeviceDto,
        origin?: DeviceUpdateOrigin,
    ): Promise<Device> {
        const fields = Object.keys(updatedDevice);
        for (const field of fields.filter(field => !DEVICE_CONFIG_SECTIONS.includes(field as DeviceConfigSection))) {
            device[field] = updatedDevice[field];
        }

        const policy = this.buildValidationPolicy(origin);
        // Assign controls and measurements last to choose a correct control service in case device config keys have been changed on the device (brand/protocol)
        if (fields.includes('controls')) {
            device.controls = await this.getControlService(device).mergeValidateControls(updatedDevice.controls, device.controls, policy);
        }
        if (fields.includes('measurements')) {
            device.measurements = await this.getControlService(device).mergeValidateMeasurements(
                updatedDevice.measurements,
                device.measurements,
                policy,
            );
        }
        return device;
    }

    private buildValidationPolicy(origin?: DeviceUpdateOrigin): DeviceConfigValidationPolicy {
        return origin === DeviceUpdateOrigin.Device ? DeviceConfigValidationPolicy.Sanitize : DeviceConfigValidationPolicy.Reject;
    }
}
