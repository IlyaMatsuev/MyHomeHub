import { DevicePayload } from 'devices/interfaces';

export enum ScenarioTriggerSourceType {
    Cron = 'cron',
    Device = 'device',
}

export enum ScenarioCronTimeAdjustOption {
    Sunrise = 'sunrise',
    Sunset = 'sunset',
}

export interface ScenarioExecutionContext {
    scheduled?: boolean;
    commands?: DevicePayload;
}
