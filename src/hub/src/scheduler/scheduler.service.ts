import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SchedulerJob } from 'scheduler/interfaces';
import { ScenariosService } from 'scenarios/scenarios.service';
import { CRON_WITH_SECONDS_LENGTH, DAY_TIME_ADJUSTMENT_JOB_CRON } from 'scheduler/scheduler.constants';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
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

    @Cron(DAY_TIME_ADJUSTMENT_JOB_CRON)
    private async handleDayTimeAdjustments() {
        this.logger.log('Recalculating scenarios day-time adjustments');
        try {
            const latitude = this.configService.get<number>('TZ_LATITUDE');
            const longitude = this.configService.get<number>('TZ_LONGITUDE');
            const now = new Date();
            this.logger.debug(`now: ${now}`);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            this.logger.debug(`today: ${today}`);
            this.logger.debug(`today utc: ${Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())}`);
            const sunriseTime = getSunrise(latitude, longitude, today);
            const sunsetTime = getSunset(latitude, longitude, today);

            this.logger.debug(`Sunrise time: ${sunriseTime}`);
            this.logger.debug(`Sunset time: ${sunsetTime}`);

            const scenariosWithDayTimeAdjustments = await this.scenariosService.getScenariosWithAdjustableTime();

            this.logger.debug(`Scenarios to be adjusted: ${scenariosWithDayTimeAdjustments.length}`);

            for (const scenario of scenariosWithDayTimeAdjustments) {
                const trigger = {
                    ...scenario.trigger,
                    sources: scenario.trigger.sources.map(source => this.adjustScenarioSource(source, sunriseTime, sunsetTime)),
                };
                await this.scenariosService.updateScenario(scenario.externalId, { trigger });
            }
        } catch (error) {
            this.logger.error(`Failed to adjust day time of the scenarios: ${error}`);
        }
    }

    private adjustScenarioSource(source: ScenarioTriggerSource, sunriseTime: Date, sunsetTime: Date): ScenarioTriggerSource {
        if (source.type === ScenarioTriggerSourceType.Cron) {
            const cronSource = source as ScenarioCronTriggerSource;
            if (cronSource.adjustTo === ScenarioCronTimeAdjustOption.Sunrise) {
                cronSource.cron = this.updateCronTime(cronSource.cron, sunriseTime);
            } else if (cronSource.adjustTo === ScenarioCronTimeAdjustOption.Sunset) {
                cronSource.cron = this.updateCronTime(cronSource.cron, sunsetTime);
            }
        }
        return source;
    }

    private updateCronTime(cron: string, dateTime: Date): string {
        const hours = dateTime.getHours().toString();
        const minutes = dateTime.getMinutes().toString();

        const cronParts = cron.split(' ');
        if (cronParts.length === CRON_WITH_SECONDS_LENGTH) {
            cronParts.shift();
        }
        cronParts.shift();
        cronParts.shift();
        return [minutes, hours, ...cronParts].join(' ');
    }
}
