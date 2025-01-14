import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DevicesController } from 'devices/devices.controller';
import { DevicesService } from 'devices/devices.service';
import { DevicesGateway } from 'devices/devices.gateway';
import { devicesProviders } from 'devices/devices.providers';

@Module({
    imports: [DatabaseModule],
    controllers: [DevicesController],
    providers: [DevicesService, DevicesGateway, ...devicesProviders],
})
export class DevicesModule {}
