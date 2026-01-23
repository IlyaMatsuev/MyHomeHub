export interface SchedulerJob {
    name: string;
    cron: string;
    handler: () => void | Promise<void>;
}
