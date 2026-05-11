import { Connection } from 'mongoose';
import { MONGODB_PROVIDER_NAME } from 'db/db.constants';
import { ScenarioSchema } from 'scenarios/schemas/scenario.schema';
import { ScenarioGroupSchema } from 'scenarios/schemas/scenario-group.schema';
import {
    SCENARIO_MODEL_PROVIDER_NAME,
    SCENARIO_SCHEMA_NAME,
    SCENARIO_GROUP_MODEL_PROVIDER_NAME,
    SCENARIO_GROUP_SCHEMA_NAME,
} from 'scenarios/scenarios.constants';

export const scenariosProviders = [
    {
        provide: SCENARIO_MODEL_PROVIDER_NAME,
        useFactory: (connection: Connection) => connection.model(SCENARIO_SCHEMA_NAME, ScenarioSchema),
        inject: [MONGODB_PROVIDER_NAME],
    },
    {
        provide: SCENARIO_GROUP_MODEL_PROVIDER_NAME,
        useFactory: (connection: Connection) => connection.model(SCENARIO_GROUP_SCHEMA_NAME, ScenarioGroupSchema),
        inject: [MONGODB_PROVIDER_NAME],
    },
];
