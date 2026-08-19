import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { DeviceConfigsParserService } from 'device-configs/device-configs-parser.service';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { deviceConfigsProviders } from 'device-configs/device-configs.providers';

@Module({
    imports: [DatabaseModule],
    providers: [DeviceConfigsService, DeviceConfigsParserService, DeviceConfigsMapperService, ...deviceConfigsProviders],
    exports: [DeviceConfigsService, DeviceConfigsMapperService],
})
export class DeviceConfigsModule {}
