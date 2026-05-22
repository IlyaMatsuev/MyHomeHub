import { isValidCron } from 'cron-validator';
import {
    Scenario,
    ScenarioCronTriggerSource,
    ScenarioDeviceTriggerSource,
    ScenarioTriggerSource,
    ScenarioTriggerSourceType,
} from 'scenarios/interfaces';
import { MAX_CRON_TRIGGER_SOURCES_PER_SCENARIO } from 'scenarios/scenarios.constants';

export const TRIGGER_SOURCE_TYPE_VALIDATORS: {
    [key in ScenarioTriggerSourceType]: (triggerSource: ScenarioTriggerSource) => boolean | never;
} = {
    [ScenarioTriggerSourceType.Cron]: validateCronTriggerSource,
    [ScenarioTriggerSourceType.Device]: validateDeviceTriggerSource,
};

export function objectIsEmpty(obj?: Record<string, object>): boolean {
    return !Object.keys(obj || {}).length;
}

function validateCronTriggerSource(triggerSource: ScenarioCronTriggerSource): boolean | never {
    const plainTriggerSource = triggerSource['toObject']({ getters: true });
    const scenario: Scenario = triggerSource['parent']();
    if (scenario.trigger.sources.filter(s => s.type === ScenarioTriggerSourceType.Cron).length > MAX_CRON_TRIGGER_SOURCES_PER_SCENARIO) {
        throw new Error('There can be only one cron trigger source per scenario');
    }

    if ('device' in plainTriggerSource) {
        throw new Error(`The "device" field is only valid for the "${ScenarioTriggerSourceType.Device}" trigger source type`);
    }
    return true;
}

function validateDeviceTriggerSource(triggerSource: ScenarioDeviceTriggerSource): boolean | never {
    const plainTriggerSource = triggerSource['toObject']({ getters: true });
    if ('cron' in plainTriggerSource) {
        throw new Error(`The "cron" field is only valid for the "${ScenarioTriggerSourceType.Cron}" trigger source type`);
    }
    if ('adjustTo' in plainTriggerSource) {
        throw new Error(`The "adjustTo" field is only valid for the "${ScenarioTriggerSourceType.Cron}" trigger source type`);
    }
    return true;
}

export function validateCronExpression(value: string): boolean | never {
    return isValidCron(value);
}

export function validateDeviceExternalId(): boolean | never {
    const device = this.device;
    return !objectIsEmpty(device.controls?.are) || !objectIsEmpty(device.measurements?.are) || !objectIsEmpty(device.commands?.are);
}

export function validateTriggerLogic(value: string): boolean | never {
    if (!/^\(*\d+\)*(?: *(?:AND|OR) *\(*\d+\)*)*$/.test(value)) {
        throw new Error('Trigger logic expression must be a valid boolean expression in the following format: (1 AND 2) OR 3');
    }
    const triggerSources = this.trigger.sources;
    const operands = Array.from(value.match(/\d+/g)).map(o => +o);
    if (operands.length !== triggerSources.length || operands.some(o => o > triggerSources.length)) {
        throw new Error('The number of trigger sources does not match the number and combination of operands used in the logic expression');
    }
    return true;
}

export function validateScenarioDeviceAction(): boolean | never {
    return !this.set || !objectIsEmpty(this.set.controls) || !objectIsEmpty(this.set.measurements);
}
