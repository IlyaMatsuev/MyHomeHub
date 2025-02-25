import { Module } from '@nestjs/common';
import { DatabaseModule } from 'db/db.module';
import { ScenariosController } from 'scenarios/scenarios.controller';
import { ScenariosService } from 'scenarios/scenarios.service';
import { ScenariosExecutionService } from 'scenarios/scenarios-execution.service';
import { SchedulerModule } from 'scheduler/scheduler.module';
import { DevicesModule } from 'devices/devices.module';
import { CommonModule } from 'common/common.module';
import { scenariosProviders } from 'scenarios/scenarios.providers';

@Module({
    imports: [DatabaseModule, SchedulerModule, DevicesModule, CommonModule],
    controllers: [ScenariosController],
    providers: [ScenariosService, ScenariosExecutionService, ...scenariosProviders],
})
export class ScenariosModule {}
