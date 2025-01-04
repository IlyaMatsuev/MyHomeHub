import { Body, Controller, Get, Post } from '@nestjs/common';
import { DeviceService } from 'devices/device.service';
import { Device } from 'devices/interfaces';
import { CreateDeviceDto } from 'devices/dto';

@Controller('devices')
export class DevicesController {
    constructor(private readonly deviceService: DeviceService) {}

    @Get()
    getDevices(): Array<Device> {
        return this.deviceService.getDevices();
    }

    @Post()
    addDevice(@Body() createDeviceDto: CreateDeviceDto): Device {
        return this.deviceService.addDevice(createDeviceDto);
    }
}
