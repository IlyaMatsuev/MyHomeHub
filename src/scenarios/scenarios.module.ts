import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { DevicesModule } from 'devices/devices.module';
import { ScenariosController } from 'scenarios/scenarios.controller';
import { ScenariosService } from 'scenarios/scenarios.service';
import { ScenarioGroupsService } from 'scenarios/scenario-groups.service';
import { ScenariosExecutionService } from 'scenarios/scenarios-execution.service';
import { ScenariosValidatorService } from 'scenarios/scenarios-validator.service';
import { DeviceConfigsModule } from 'device-configs/device-configs.module';
import { SchedulerModule } from 'scheduler/scheduler.module';
import { scenariosProviders } from 'scenarios/scenarios.providers';

@Module({
    imports: [DatabaseModule, DevicesModule, DeviceConfigsModule, SchedulerModule],
    controllers: [ScenariosController],
    providers: [ScenariosService, ScenarioGroupsService, ScenariosExecutionService, ScenariosValidatorService, ...scenariosProviders],
    exports: [ScenariosService],
})
export class ScenariosModule {}
