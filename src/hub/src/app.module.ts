import { Module } from '@nestjs/common';
import { DevicesController } from 'devices/devices.controller';
import { DeviceService } from 'devices/device.service';

// TODO: Split project into separate modules
@Module({
    imports: [],
    controllers: [DevicesController],
    providers: [DeviceService],
})
export class AppModule {}
