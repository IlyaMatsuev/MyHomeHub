import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SchedulerJob } from 'scheduler/interfaces';

@Injectable()
export class SchedulerService {
    constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

    scheduleJob(job: SchedulerJob): CronJob {
        const newJob = new CronJob(job.cron, () => job.handler());
        this.schedulerRegistry.addCronJob(job.name, newJob);
        newJob.start();
        return newJob;
    }

    unscheduleJob(jobName: string): void {
        this.schedulerRegistry.deleteCronJob(jobName);
    }
}
