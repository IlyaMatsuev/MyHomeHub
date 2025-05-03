import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { Device, DeviceFilter, DevicesPage, GetDeviceOptions } from 'devices/interfaces';
import { GetDevicesDto, CreateDeviceDto, UpdateDeviceDto } from 'devices/dto';
import { DeviceControlsUpdatedEvent, DeviceMeasurementsUpdatedEvent } from 'devices/events';
import { DEVICE_MODEL_PROVIDER_NAME } from 'devices/devices.constants';
import { DeviceControlService, DeviceControlServiceFactory } from 'devices/control-services';

@Injectable()
export class DevicesService {
    constructor(
        @Inject(DEVICE_MODEL_PROVIDER_NAME)
        private readonly deviceModel: Model<Device>,
        private readonly deviceControlServiceFactory: DeviceControlServiceFactory,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    getControlService<T extends DeviceControlService>(device: Device): T {
        return this.deviceControlServiceFactory.getControlService<T>(device);
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

    // TODO: Rename field "deviceAddress" to "deviceLocalIP"
    getDeviceByIp(ip: string, options: GetDeviceOptions = { strict: true }): Promise<Device> {
        return this.getDevice({ deviceAddress: `http://${ip}` }, options);
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
        return new this.deviceModel(deviceDto).save({ validateBeforeSave: true });
    }

    async updateDevice(externalId: string, updateDeviceInfoDto: UpdateDeviceDto): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        Object.keys(updateDeviceInfoDto).forEach(field => (device[field] = updateDeviceInfoDto[field]));
        const updatedDevice = await device.save({ validateBeforeSave: true });
        if (updateDeviceInfoDto.controlsUpdated) {
            this.eventEmitter.emit(
                DeviceControlsUpdatedEvent.eventName,
                new DeviceControlsUpdatedEvent(externalId, updateDeviceInfoDto.controls),
            );
        }
        if (updateDeviceInfoDto.measurementsUpdated) {
            this.eventEmitter.emit(DeviceMeasurementsUpdatedEvent.eventName, new DeviceMeasurementsUpdatedEvent(externalId));
        }
        return updatedDevice;
    }

    async removeDevice(externalId: string): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        await this.deviceModel.deleteOne({ _id: device._id }).exec();
        return device;
    }
}
