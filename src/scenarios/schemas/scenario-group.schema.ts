import { Model, Schema } from 'mongoose';
import { SCENARIO_GROUP_NAME_MAX_LENGTH } from 'scenarios/scenarios.constants';
import { ScenarioGroup } from 'scenarios/interfaces';
import { getNextScenarioGroupId } from './scenario-group.helpers';

export const ScenarioGroupSchema = new Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
            index: true,
        },
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

ScenarioGroupSchema.pre('save', async function (next) {
    if (this.isNew && this.id === undefined) {
        this.id = await getNextScenarioGroupId(this.constructor as Model<ScenarioGroup>);
    }
    next();
});
