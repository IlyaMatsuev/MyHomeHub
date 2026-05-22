import { ScenarioCronTimeAdjustOption, ScenarioTriggerSourceType } from 'scenarios/interfaces';
import { TRIGGER_SOURCE_TYPE_VALIDATORS, validateCronExpression, validateDeviceExternalId } from './scenario.validators';

export const TriggerSourceSchema = {
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
            validator: validateCronExpression,
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
                validator: validateDeviceExternalId,
                message: 'Either one of "controls.are", "measurements.are" or "commands.are" conditions needs to be set',
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
        commands: {
            are: {
                type: Object,
                required: false,
            },
        },
    },
};
