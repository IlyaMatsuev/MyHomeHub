import { Document } from 'mongodb';
import { ScenarioCronTimeAdjustOption, ScenarioTriggerSourceType } from 'scenarios/interfaces';

export interface ScenarioTriggerSource {
    type: ScenarioTriggerSourceType;
}

export interface ScenarioCronTriggerSource extends ScenarioTriggerSource {
    type: ScenarioTriggerSourceType.Cron;
    cron: string;
    adjustTo?: ScenarioCronTimeAdjustOption;
}

export interface ScenarioDeviceTriggerSourceConditions {
    are: Record<string, object>;
}

export interface ScenarioDeviceTriggerSource extends ScenarioTriggerSource {
    type: ScenarioTriggerSourceType.Device;
    device: {
        externalId: string;
        controls?: ScenarioDeviceTriggerSourceConditions;
        measurements?: ScenarioDeviceTriggerSourceConditions;
    };
}

export interface ScenarioTrigger {
    sources: Array<ScenarioTriggerSource>;
    logic: string;
}

export interface ScenarioDevice {
    externalId: string;
    set: {
        controls?: Record<string, object>;
        measurements?: Record<string, object>;
    };
}

export interface Scenario extends Document {
    externalId: string;
    name: string;
    description?: string;
    active: boolean;
    repeatTimes?: number;
    trigger: ScenarioTrigger;
    devices: Array<ScenarioDevice>;
}

export type ScenarioFilter = Partial<Scenario & { _id: string }>;

export interface GetScenarioOptions {
    strict: boolean;
}
