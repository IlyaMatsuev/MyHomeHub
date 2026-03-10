import { validateScenarioDeviceAction } from './scenario.validators';

export const ScenarioDeviceActionSchema = {
    externalId: {
        type: String,
        required: true,
        validate: {
            validator: validateScenarioDeviceAction,
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
