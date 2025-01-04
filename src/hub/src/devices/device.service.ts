import { Injectable } from '@nestjs/common';
import { Device, Room } from './interfaces/device.interface';

const mockDevices: Array<Device> = [
    {
        id: '1',
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
}
