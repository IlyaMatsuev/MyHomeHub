import { Schema } from 'mongoose';
import { v4 as uuid } from 'uuid';
import {
    SCENARIO_DESCRIPTION_MAX_LENGTH,
    SCENARIO_DESCRIPTION_MIN_LENGTH,
    SCENARIO_MINIMUM_REPEAT_TIMES,
    SCENARIO_NAME_MAX_LENGTH,
    SCENARIO_NAME_MIN_LENGTH,
} from 'scenarios/scenarios.constants';
import { TriggerSchema } from './trigger.schema';
import { ScenarioDeviceActionSchema } from './scenario-device-action.schema';

export const ScenarioSchema = new Schema(
    {
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
            minLength: SCENARIO_NAME_MIN_LENGTH,
            maxLength: SCENARIO_NAME_MAX_LENGTH,
        },
        description: {
            type: String,
            required: false,
            trim: true,
            minLength: SCENARIO_DESCRIPTION_MIN_LENGTH,
            maxLength: SCENARIO_DESCRIPTION_MAX_LENGTH,
        },
        active: {
            type: Boolean,
            required: false,
            default: true,
        },
        repeatTimes: {
            type: Number,
            required: false,
            minLength: SCENARIO_MINIMUM_REPEAT_TIMES,
        },
        trigger: TriggerSchema,
        devices: [ScenarioDeviceActionSchema],
    },
    { timestamps: true },
);
