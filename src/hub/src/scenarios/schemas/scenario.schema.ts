import { Schema } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { isValidCron } from 'cron-validator';
import {
    Scenario,
    ScenarioCronTriggerSource,
    ScenarioDeviceTriggerSource,
    ScenarioTriggerSource,
    ScenarioTriggerSourceType,
    ScenarioCronTimeAdjustOption,
} from 'scenarios/interfaces';
import { MAX_CRON_TRIGGER_SOURCES_PER_SCENARIO } from 'scenarios/scenarios.constants';

const TRIGGER_SOURCE_TYPE_VALIDATORS: { [key in ScenarioTriggerSourceType]: (triggerSource: ScenarioTriggerSource) => boolean | never } = {
    [ScenarioTriggerSourceType.Cron]: (triggerSource: ScenarioCronTriggerSource): boolean | never => {
        const plainTriggerSource = triggerSource['toObject']({ getters: true });
        const scenario: Scenario = triggerSource['parent']();
        if (
            scenario.trigger.sources.filter(s => s.type === ScenarioTriggerSourceType.Cron).length > MAX_CRON_TRIGGER_SOURCES_PER_SCENARIO
        ) {
            throw new Error('There can be only one cron trigger source per scenario');
        }

        if ('device' in plainTriggerSource) {
            throw new Error(`The "device" field is only valid for the "${ScenarioTriggerSourceType.Device}" trigger source type`);
        }
        return true;
    },
    [ScenarioTriggerSourceType.Device]: (triggerSource: ScenarioDeviceTriggerSource): boolean | never => {
        const plainTriggerSource = triggerSource['toObject']({ getters: true });
        if ('cron' in plainTriggerSource) {
            throw new Error(`The "cron" field is only valid for the "${ScenarioTriggerSourceType.Cron}" trigger source type`);
        }
        if ('adjustTo' in plainTriggerSource) {
            throw new Error(`The "adjustTo" field is only valid for the "${ScenarioTriggerSourceType.Cron}" trigger source type`);
        }
        return true;
    },
};

const objectIsEmpty = (obj?: Record<string, object>): boolean => {
    return !Object.keys(obj || {}).length;
};

export const ScenarioSchema = new Schema({
    externalId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => uuid(),
    },
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minLength: 3,
        maxLength: 80,
    },
    description: {
        type: String,
        required: false,
        trim: true,
        minLength: 5,
        maxLength: 255,
    },
    trigger: {
        sources: [
            {
                type: {
                    type: String,
                    required: true,
                    enum: Object.values(ScenarioTriggerSourceType) as Array<string>,
                    validate: {
                        validator: function (value: ScenarioTriggerSourceType): boolean | never {
                            return TRIGGER_SOURCE_TYPE_VALIDATORS[value](this);
                        },
                    },
                },
                cron: {
                    type: String,
                    required: function () {
                        return this.type === ScenarioTriggerSourceType.Cron;
                    },
                    validate: {
                        validator: function (value: string): boolean | never {
                            return isValidCron(value);
                        },
                        message: 'Cron expression is not valid',
                    },
                    trim: true,
                },
                adjustTo: {
                    type: String,
                    required: false,
                    enum: Object.values(ScenarioCronTimeAdjustOption) as Array<string>,
                },
                device: {
                    externalId: {
                        type: String,
                        required: false,
                        validate: {
                            validator: function (): boolean | never {
                                const device = this.device;
                                return !objectIsEmpty(device.controls?.are) || !objectIsEmpty(device.measurements?.are);
                            },
                            message: 'Either one of "controls.are" or "measurements.are" conditions needs to be set',
                        },
                    },
                    controls: {
                        are: {
                            type: Object,
                            required: false,
                        },
                    },
                    measurements: {
                        are: {
                            type: Object,
                            required: false,
                        },
                    },
                },
            },
        ],
        logic: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            maxLength: 80,
            validate: {
                validator: function (value: string): boolean | never {
                    if (!/^\(*\d+\)*(?: *(?:AND|OR) *\(*\d+\)*)*$/.test(value)) {
                        throw new Error(
                            'Trigger logic expression must be a valid boolean expression in the following format: (1 AND 2) OR 3',
                        );
                    }
                    const triggerSources = this.trigger.sources;
                    const operands = Array.from(value.match(/\d+/g)).map(o => +o);
                    if (operands.length !== triggerSources.length || operands.some(o => o > triggerSources.length)) {
                        throw new Error(
                            'The number of trigger sources does not match the number and combination of operands used in the logic expression',
                        );
                    }
                    return true;
                },
            },
        },
    },
    devices: [
        {
            externalId: {
                type: String,
                required: true,
                validate: {
                    validator: function (): boolean | never {
                        return !this.set || !objectIsEmpty(this.set.controls) || !objectIsEmpty(this.set.measurements);
                    },
                    message: 'Either one of "controls" or "measurements" setters needs to be set',
                },
            },
            set: {
                controls: {
                    type: Object,
                    required: false,
                },
                measurements: {
                    type: Object,
                    required: false,
                },
            },
        },
    ],
});
