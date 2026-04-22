import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DevicesControlModule } from 'devices-control/devices-control.module';
import { DevicesController } from 'devices/devices.controller';
import { DevicesService } from 'devices/devices.service';
import { devicesProviders } from 'devices/devices.providers';

@Module({
    imports: [DatabaseModule, DevicesControlModule],
    controllers: [DevicesController],
    providers: [DevicesService, ...devicesProviders],
    exports: [DevicesService],
})
export class DevicesModule {}
