import { validateScenarioAction } from './scenario.validators';

export const ScenarioActionSchema = {
    externalId: {
        type: String,
        required: true,
        validate: {
            validator: validateScenarioAction,
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
};
