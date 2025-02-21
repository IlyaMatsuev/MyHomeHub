import {
    ScenarioCronTriggerSource,
    ScenarioDevice,
    ScenarioDeviceTriggerSourceConditions,
    ScenarioTrigger,
    ScenarioTriggerSource,
    ScenarioTriggerSourceType,
} from 'scenarios/interfaces';

export class ScenarioTriggerSourceDto implements ScenarioTriggerSource {
    type: ScenarioTriggerSourceType;
}

export class ScenarioCronTriggerSourceDto implements ScenarioCronTriggerSource {
    type: ScenarioTriggerSourceType.Cron;
    cron: string;
}

export class ScenarioDeviceTriggerSourceConditionsDto implements ScenarioDeviceTriggerSourceConditions {
    are: Record<string, object>;
}

export class ScenarioDeviceTriggerSourceDto implements ScenarioTriggerSource {
    type: ScenarioTriggerSourceType.Cron;
    device: {
        externalId: string;
        controls?: ScenarioDeviceTriggerSourceConditionsDto;
        measurements?: ScenarioDeviceTriggerSourceConditionsDto;
    };
}

export class ScenarioTriggerDto implements ScenarioTrigger {
    sources: Array<ScenarioTriggerSourceDto>;
    logic: string;
}

export class ScenarioDeviceSettingDto {
    controls?: Record<string, object>;
    measurements?: Record<string, object>;
}

export class ScenarioDeviceDto implements ScenarioDevice {
    externalId: string;

    set: ScenarioDeviceSettingDto;
}
