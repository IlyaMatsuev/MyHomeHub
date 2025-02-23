import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { Device, DeviceFilter, GetDeviceOptions } from 'devices/interfaces';
import { CreateDeviceDto, UpdateDeviceDto } from 'devices/dto';
import { DEVICE_MODEL_PROVIDER_NAME } from 'devices/devices.constants';

@Injectable()
export class DevicesService {
    constructor(
        @Inject(DEVICE_MODEL_PROVIDER_NAME)
        private readonly deviceModel: Model<Device>,
    ) {}

    getDevices(): Promise<Array<Device>> {
        return this.deviceModel.find().exec();
    }

    getDeviceByExternalId(externalId: string, options: GetDeviceOptions = { strict: true }): Promise<Device> {
        return this.getDevice({ externalId }, options);
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

    // TODO: Emit event when device controls are updated
    // Shelly plug docs: https://shelly-api-docs.shelly.cloud/gen2/Devices/Gen2/ShellyPlusPlugS/
    async updateDevice(externalId: string, updateDeviceInfoDto: UpdateDeviceDto): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        return this.deviceModel.findByIdAndUpdate(device._id, { ...updateDeviceInfoDto }, { new: true, runValidators: true }).exec();
    }

    async removeDevice(externalId: string): Promise<Device> {
        const device = await this.getDeviceByExternalId(externalId);
        await this.deviceModel.deleteOne({ _id: device._id }).exec();
        return device;
    }
}
