import { Connection } from 'mongoose';
import { DeviceSchema } from 'devices/schemas/device.schema';
import { MONGODB_PROVIDER_NAME } from 'db/db.constants';
import { DEVICE_MODEL_PROVIDER_NAME, DEVICE_SCHEMA_NAME } from 'devices/devices.constants';

export const devicesProviders = [
    {
        provide: DEVICE_MODEL_PROVIDER_NAME,
        useFactory: (connection: Connection) => connection.model(DEVICE_SCHEMA_NAME, DeviceSchema),
        inject: [MONGODB_PROVIDER_NAME],
    },
];
