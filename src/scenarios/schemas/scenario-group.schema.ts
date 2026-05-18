import { Schema } from 'mongoose';
import {
    SCENARIO_GROUP_NAME_MAX_LENGTH,
    SCENARIO_GROUP_NAME_MIN_LENGTH,
    SCENARIO_GROUP_NAME_PATTERN,
    SCENARIO_GROUP_NAME_PATTERN_ERROR_MESSAGE,
} from 'scenarios/scenarios.constants';

export const ScenarioGroupSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
            minLength: SCENARIO_GROUP_NAME_MIN_LENGTH,
            maxLength: SCENARIO_GROUP_NAME_MAX_LENGTH,
            validate: {
                validator: (value: string) => !value || SCENARIO_GROUP_NAME_PATTERN.test(value),
                message: SCENARIO_GROUP_NAME_PATTERN_ERROR_MESSAGE,
            },
        },
        scenariosCount: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true },
);
