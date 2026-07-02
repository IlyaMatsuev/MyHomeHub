import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { DeviceConfigsParserService } from 'device-configs/device-configs-parser.service';
import { deviceConfigsProviders } from 'device-configs/device-configs.providers';

@Module({
    imports: [DatabaseModule],
    providers: [DeviceConfigsService, DeviceConfigsParserService, ...deviceConfigsProviders],
    exports: [DeviceConfigsService],
})
export class DeviceConfigsModule {}
