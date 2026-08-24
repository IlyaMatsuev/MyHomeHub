import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DeviceConfigsService } from 'device-configs/device-configs.service';
import { DeviceConfigsParserService } from 'device-configs/device-configs-parser.service';
import { DeviceConfigsMapperService } from 'device-configs/device-configs-mapper.service';
import { DeviceConfigsValidatorService } from 'device-configs/device-configs-validator.service';
import { deviceConfigsProviders } from 'device-configs/device-configs.providers';

@Module({
    imports: [DatabaseModule],
    providers: [
        DeviceConfigsService,
        DeviceConfigsParserService,
        DeviceConfigsMapperService,
        DeviceConfigsValidatorService,
        ...deviceConfigsProviders,
    ],
    exports: [DeviceConfigsService, DeviceConfigsMapperService, DeviceConfigsValidatorService],
})
export class DeviceConfigsModule {}
