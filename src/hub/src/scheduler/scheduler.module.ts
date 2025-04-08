import { forwardRef, Module } from '@nestjs/common';
import { SchedulerService } from 'scheduler/scheduler.service';
import { ScenariosModule } from 'scenarios/scenarios.module';

@Module({
    imports: [forwardRef(() => ScenariosModule)],
    providers: [SchedulerService],
    exports: [SchedulerService],
})
export class SchedulerModule {}
