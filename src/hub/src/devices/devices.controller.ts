import { Controller, Get } from '@nestjs/common';
import { DeviceService } from 'devices/device.service';
import { DeviceDto } from 'devices/dto/create-device.dto';

@Controller('devices')
export class DevicesController {
    constructor(private readonly deviceService: DeviceService) {}

    @Get()
    getDevices(): Array<DeviceDto> {
        return this.deviceService.getDevices();
    }
}
