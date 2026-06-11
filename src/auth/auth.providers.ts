import { Connection } from 'mongoose';
import { RegistrationRequestSchema } from 'auth/schemas/registration-request.schema';
import { MONGODB_PROVIDER_NAME } from 'db/db.constants';
import { REGISTRATION_REQUEST_MODEL_PROVIDER_NAME, REGISTRATION_REQUEST_SCHEMA_NAME } from 'auth/auth.constants';

export const authProviders = [
    {
        provide: REGISTRATION_REQUEST_MODEL_PROVIDER_NAME,
        useFactory: (connection: Connection) => connection.model(REGISTRATION_REQUEST_SCHEMA_NAME, RegistrationRequestSchema),
        inject: [MONGODB_PROVIDER_NAME],
    },
];
