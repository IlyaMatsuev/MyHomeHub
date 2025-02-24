import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { ScenarioTriggerSourceType } from 'scenarios/interfaces/common.interface';

export interface ScenarioTriggerSource {
    type: ScenarioTriggerSourceType;
}

export interface ScenarioCronTriggerSource extends ScenarioTriggerSource {
    type: ScenarioTriggerSourceType.Cron;
    cron: string;
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

export interface Scenario extends Document<ObjectId> {
    externalId: string;
    name: string;
    description?: string;
    trigger: ScenarioTrigger;
    devices: Array<ScenarioDevice>;
}

export type ScenarioFilter = Partial<Omit<Scenario, keyof Document> & { _id: ObjectId }>;

export interface GetScenariosOptions {
    strict: boolean;
}
