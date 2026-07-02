import { Connection } from 'mongoose';
import { DeviceConfigSchema } from 'device-configs/schemas/device-config.schema';
import { MONGODB_PROVIDER_NAME } from 'db/db.constants';
import { DEVICE_CONFIG_MODEL_PROVIDER_NAME, DEVICE_CONFIG_SCHEMA_NAME } from 'device-configs/device-configs.constants';

export const deviceConfigsProviders = [
    {
        provide: DEVICE_CONFIG_MODEL_PROVIDER_NAME,
        useFactory: (connection: Connection) => connection.model(DEVICE_CONFIG_SCHEMA_NAME, DeviceConfigSchema),
        inject: [MONGODB_PROVIDER_NAME],
    },
];
