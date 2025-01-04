import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Device, Room } from './interfaces';
import { CreateDeviceDto, UpdateDeviceDto } from 'devices/dto';
import { v4 as uuid } from 'uuid';

let mockDevices: Array<Device> = [
    {
        id: 'f1256ed1-7116-4fbe-981b-b81578fce899',
        name: 'PS Fans',
        room: Room.LivingRoom,
        updateInterval: 10000,
        controls: {
            on: true,
            fanSpeedLevel: 1,
        },
        measurements: {
            temperature: 44.2,
        },
    },
];

@Injectable()
export class DevicesService {
    getDevices(): Array<Device> {
        return mockDevices;
    }

    getDevice(id: string): Device {
        const device = mockDevices.find(d => d.id === id);
        if (!device) {
            throw new NotFoundException(`There is no device with the provided id '${id}'`);
        }
        return device;
    }

    addDevice(deviceDto: CreateDeviceDto): Device {
        if (mockDevices.some(d => d.name === deviceDto.name)) {
            throw new BadRequestException(`Device with the same name ('${deviceDto.name}') already exists`);
        }

        const newDevice: Device = {
            id: uuid(),
            ...deviceDto,
        };
        mockDevices.push(newDevice);
        return newDevice;
    }

    removeDevice(id: string): Device {
        const device = this.getDevice(id);
        mockDevices = mockDevices.filter(d => d.id !== id);
        return device;
    }

    updateDevice(id: string, updateDeviceInfoDto: UpdateDeviceDto): Device {
        const device = this.getDevice(id);
        device.name = updateDeviceInfoDto.name ?? device.name;
        device.room = updateDeviceInfoDto.room ?? device.room;
        device.updateInterval = updateDeviceInfoDto.updateInterval ?? device.updateInterval;
        device.controls = updateDeviceInfoDto.controls ?? device.controls;
        device.measurements = updateDeviceInfoDto.measurements ?? device.measurements;
        return device;
    }
}
