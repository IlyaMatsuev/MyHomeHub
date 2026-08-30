import { Document } from 'mongodb';
import { ScenarioCronTimeAdjustOption, ScenarioTriggerSourceType } from 'scenarios/interfaces';
import { DEVICE_CONFIG_SECTIONS } from 'device-configs/interfaces';

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

export type ScenarioDeviceConditionSection = (typeof DEVICE_CONFIG_SECTIONS)[number];

export interface ScenarioDeviceTriggerSource extends ScenarioTriggerSource {
    type: ScenarioTriggerSourceType.Device;
    device: {
        externalId: string;
        controls?: ScenarioDeviceTriggerSourceConditions;
        measurements?: ScenarioDeviceTriggerSourceConditions;
        commands?: ScenarioDeviceTriggerSourceConditions;
    };
}

export interface ScenarioTrigger {
    sources: Array<ScenarioTriggerSource>;
    logic: string;
}

export interface ScenarioAction {
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
    group?: string;
    active: boolean;
    repeatTimes?: number;
    trigger: ScenarioTrigger;
    actions: Array<ScenarioAction>;
    createdAt: Date;
    updatedAt: Date;
}

export type ScenarioFilter = Partial<Scenario & { _id: string }>;

export interface GetScenarioOptions {
    strict: boolean;
}
