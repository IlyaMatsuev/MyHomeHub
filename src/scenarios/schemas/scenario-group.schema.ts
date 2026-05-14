import { Schema } from 'mongoose';
import { SCENARIO_GROUP_NAME_MAX_LENGTH } from 'scenarios/scenarios.constants';

export const ScenarioGroupSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
            maxLength: SCENARIO_GROUP_NAME_MAX_LENGTH,
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
