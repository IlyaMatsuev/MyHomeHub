import { Controller, Body, Param, Get, Delete, Post, Put } from '@nestjs/common';
import { DeviceService } from 'devices/device.service';
import { Device } from 'devices/interfaces';
import { CreateDeviceDto, UpdateDeviceDto } from 'devices/dto';

@Controller('devices')
export class DevicesController {
    constructor(private readonly deviceService: DeviceService) {}

    @Get()
    getDevices(): Array<Device> {
        return this.deviceService.getDevices();
    }

    @Get(':id')
    getDevice(@Param('id') id: string): Device {
        return this.deviceService.getDevice(id);
    }

    @Post()
    addDevice(@Body() createDeviceDto: CreateDeviceDto): Device {
        return this.deviceService.addDevice(createDeviceDto);
    }

    @Put('/:id')
    updateDevice(@Param('id') id: string, @Body() updateDeviceDto: UpdateDeviceDto): Device {
        return this.deviceService.updateDevice(id, updateDeviceDto);
    }

    @Delete('/:id')
    removeDevice(@Param('id') id: string): Device {
        return this.deviceService.removeDevice(id)
    }
}
