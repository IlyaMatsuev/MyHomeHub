import { Controller, Body, Param, Get, Delete, Post, Put } from '@nestjs/common';
import { DevicesService } from 'devices/devices.service';
import { Device } from 'devices/interfaces';
import { CreateDeviceDto, UpdateDeviceDto } from 'devices/dto';

@Controller('devices')
export class DevicesController {
    constructor(private readonly deviceService: DevicesService) {}

    @Get()
    async getDevices(): Promise<Array<Device>> {
        return this.deviceService.getDevices();
    }

    @Get(':id')
    async getDevice(@Param('id') id: string): Promise<Device> {
        return this.deviceService.getDeviceById(id);
    }

    @Post()
    async addDevice(@Body() createDeviceDto: CreateDeviceDto): Promise<Device> {
        return this.deviceService.addDevice(createDeviceDto);
    }

    @Put('/:id')
    async updateDevice(@Param('id') id: string, @Body() updateDeviceDto: UpdateDeviceDto): Promise<Device> {
        return this.deviceService.updateDevice(id, updateDeviceDto);
    }

    @Delete('/:id')
    async removeDevice(@Param('id') id: string): Promise<Device> {
        return this.deviceService.removeDevice(id);
    }
}
