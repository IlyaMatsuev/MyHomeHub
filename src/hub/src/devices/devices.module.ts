import { Module } from '@nestjs/common';
import { DevicesController } from 'devices/devices.controller';
import { DevicesService } from 'devices/devices.service';
import { DevicesGateway } from 'devices/devices.gateway';

@Module({
    controllers: [DevicesController],
    providers: [DevicesService, DevicesGateway],
})
export class DevicesModule {}
