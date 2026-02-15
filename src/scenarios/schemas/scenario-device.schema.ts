import { validateScenarioDeviceExternalId } from './scenario.validators';

export const ScenarioDeviceSchema = {
    externalId: {
        type: String,
        required: true,
        validate: {
            validator: validateScenarioDeviceExternalId,
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
