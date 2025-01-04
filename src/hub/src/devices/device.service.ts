import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Device, Room } from './interfaces';
import { CreateDeviceDto } from 'devices/dto';
import { v4 as uuid } from 'uuid';

const mockDevices: Array<Device> = [
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
export class DeviceService {
    getDevices(): Array<Device> {
        return mockDevices;
    }

    addDevice(deviceDto: CreateDeviceDto): Device {
        if (mockDevices.some(d => d.name === deviceDto.name)) {
            throw new HttpException({ error: `Device with the same name ('${deviceDto.name}') already exists` }, HttpStatus.BAD_REQUEST);
        }

        const newDevice: Device = {
            id: uuid(),
            ...deviceDto,
        };
        mockDevices.push(newDevice);
        return newDevice;
    }
}
