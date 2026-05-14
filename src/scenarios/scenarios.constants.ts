export const SCENARIO_MODEL_PROVIDER_NAME = 'SCENARIO_MODEL';
export const SCENARIO_SCHEMA_NAME = 'Scenario';
export const SCENARIO_GROUP_MODEL_PROVIDER_NAME = 'SCENARIO_GROUP_MODEL';
export const SCENARIO_GROUP_SCHEMA_NAME = 'ScenarioGroup';
export const MAX_CRON_TRIGGER_SOURCES_PER_SCENARIO = 1;

export const SCENARIO_NAME_MIN_LENGTH = 3;
export const SCENARIO_NAME_MAX_LENGTH = 80;
export const SCENARIO_DESCRIPTION_MIN_LENGTH = 10;
export const SCENARIO_DESCRIPTION_MAX_LENGTH = 255;
export const SCENARIO_TRIGGER_LOGIC_MIN_LENGTH = 1;
export const SCENARIO_TRIGGER_LOGIC_MAX_LENGTH = 80;
export const SCENARIO_MINIMUM_REPEAT_TIMES = 1;

export const SCENARIO_GROUP_NAME_MAX_LENGTH = 40;
export const SCENARIO_GROUP_NAME_PATTERN = /^(?![0-9]+$)[A-Za-z0-9_]+$/;
export const SCENARIO_GROUP_NAME_PATTERN_ERROR_MESSAGE =
    'Group name must contain only English letters, digits, and underscores, and cannot be digits only';
