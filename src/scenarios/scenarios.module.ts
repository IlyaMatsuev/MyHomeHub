import { Module } from '@nestjs/common';
import { CommonModule } from 'common/common.module';
import { DatabaseModule } from 'db/db.module';
import { DevicesModule } from 'devices/devices.module';
import { ScenariosController } from 'scenarios/scenarios.controller';
import { ScenariosService } from 'scenarios/scenarios.service';
import { ScenarioGroupsService } from 'scenarios/scenario-groups.service';
import { ScenariosExecutionService } from 'scenarios/scenarios-execution.service';
import { SchedulerModule } from 'scheduler/scheduler.module';
import { scenariosProviders } from 'scenarios/scenarios.providers';

@Module({
    imports: [CommonModule, DatabaseModule, DevicesModule, SchedulerModule],
    controllers: [ScenariosController],
    providers: [ScenariosService, ScenarioGroupsService, ScenariosExecutionService, ...scenariosProviders],
    exports: [ScenariosService, ScenarioGroupsService],
})
export class ScenariosModule {}
