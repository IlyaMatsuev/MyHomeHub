import { SCENARIO_TRIGGER_LOGIC_MAX_LENGTH, SCENARIO_TRIGGER_LOGIC_MIN_LENGTH } from 'scenarios/scenarios.constants';
import { TriggerSourceSchema } from './trigger-source.schema';
import { validateTriggerLogic } from './scenario.validators';

export const TriggerSchema = {
    sources: [TriggerSourceSchema],
    logic: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        minLength: SCENARIO_TRIGGER_LOGIC_MIN_LENGTH,
        maxLength: SCENARIO_TRIGGER_LOGIC_MAX_LENGTH,
        validate: {
            validator: validateTriggerLogic,
        },
    },
};
