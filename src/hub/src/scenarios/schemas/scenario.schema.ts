import { Schema } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { ScenarioTriggerSourceType } from 'scenarios/interfaces';

// TODO: Add validations for trigger sources
// https://mongoosejs.com/docs/validation.html#custom-validators
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
                },
                cron: {
                    type: String,
                    required: false,
                    trim: true,
                },
                device: {
                    externalId: {
                        type: String,
                        required: false,
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
            maxLength: 80,
        },
    },
    devices: [
        {
            externalId: {
                type: String,
                required: true,
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
