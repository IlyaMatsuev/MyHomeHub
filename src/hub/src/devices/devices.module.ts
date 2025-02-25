import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DevicesController } from 'devices/devices.controller';
import { DevicesService } from 'devices/devices.service';
import { DevicesGateway } from 'devices/devices.gateway';
import { DeviceControlServiceFactory } from 'devices/control-services';
import { devicesProviders } from 'devices/devices.providers';

@Module({
    imports: [DatabaseModule],
    controllers: [DevicesController],
    providers: [DevicesService, DevicesGateway, DeviceControlServiceFactory, ...devicesProviders],
    exports: [DevicesService],
})
export class DevicesModule {}
