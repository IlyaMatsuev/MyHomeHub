import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SchedulerJob } from 'scheduler/interfaces';
import { ScenariosService } from 'scenarios/scenarios.service';
import { CRON_WITH_SECONDS_LENGTH, DAY_TIME_ADJUSTMENT_JOB_CRON } from 'scheduler/scheduler.constants';
import { getTimes } from 'suncalc';
import {
    ScenarioCronTimeAdjustOption,
    ScenarioCronTriggerSource,
    ScenarioTriggerSource,
    ScenarioTriggerSourceType,
} from 'scenarios/interfaces';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);
    private static adjustableDayTimes: { [key in ScenarioCronTimeAdjustOption]: Date };

    constructor(
        @Inject(forwardRef(() => ScenariosService))
        private readonly scenariosService: ScenariosService,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly configService: ConfigService,
    ) {}

    scheduleJob(job: SchedulerJob): CronJob {
        const newJob = new CronJob(job.cron, () => job.handler());
        this.schedulerRegistry.addCronJob(job.name, newJob);
        newJob.start();
        return newJob;
    }

    unscheduleJob(jobName: string): void {
        this.schedulerRegistry.deleteCronJob(jobName);
    }

    adjustScenarioDayTimeCron(source: ScenarioCronTriggerSource): string {
        return this.updateCronTime(source.cron, source.adjustTo);
    }

    @Cron(DAY_TIME_ADJUSTMENT_JOB_CRON)
    private async handleDayTimeAdjustments() {
        this.logger.log('Recalculating scenarios day-time adjustments');
        try {
            const scenariosWithDayTimeAdjustments = await this.scenariosService.getScenariosWithAdjustableTime();

            this.logger.debug(`Scenarios to be adjusted: ${scenariosWithDayTimeAdjustments.length}`);

            for (const scenario of scenariosWithDayTimeAdjustments) {
                const trigger = {
                    ...scenario.trigger,
                    sources: scenario.trigger.sources.map(source => this.adjustScenarioSource(source)),
                };
                await this.scenariosService.updateScenario(scenario.externalId, { trigger });
            }
        } catch (error) {
            this.logger.error(`Failed to adjust day time of the scenarios: ${error}`);
        }
    }

    private adjustScenarioSource(source: ScenarioTriggerSource): ScenarioTriggerSource {
        if (source.type === ScenarioTriggerSourceType.Cron) {
            const cronSource = source as ScenarioCronTriggerSource;
            cronSource.cron = this.updateCronTime(cronSource.cron, cronSource.adjustTo);
        }
        return source;
    }

    private updateCronTime(cron: string, adjustTo: ScenarioCronTimeAdjustOption): string {
        const dayTimes = this.getDayTimes();
        const hours = dayTimes[adjustTo].getHours().toString();
        const minutes = dayTimes[adjustTo].getMinutes().toString();

        const cronParts = cron.split(' ');
        if (cronParts.length === CRON_WITH_SECONDS_LENGTH) {
            cronParts.shift();
        }
        cronParts.shift();
        cronParts.shift();
        return [minutes, hours, ...cronParts].join(' ');
    }

    private getDayTimes(): { [key in ScenarioCronTimeAdjustOption]: Date } {
        if (!SchedulerService.adjustableDayTimes) {
            const latitude = this.configService.get<number>('TZ_LATITUDE');
            const longitude = this.configService.get<number>('TZ_LONGITUDE');
            const { sunrise, sunset } = getTimes(new Date(), latitude, longitude);
            this.logger.debug(`Sunrise time: ${sunrise}`);
            this.logger.debug(`Sunset time: ${sunset}`);
            SchedulerService.adjustableDayTimes = { sunrise, sunset };
        }
        return SchedulerService.adjustableDayTimes;
    }
}
