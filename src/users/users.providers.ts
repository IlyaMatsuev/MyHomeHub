import { Connection } from 'mongoose';
import { UserSchema } from 'users/schemas/user.schema';
import { MONGODB_PROVIDER_NAME } from 'db/db.constants';
import { USER_MODEL_PROVIDER_NAME, USER_SCHEMA_NAME } from 'users/users.constants';

export const usersProviders = [
    {
        provide: USER_MODEL_PROVIDER_NAME,
        useFactory: (connection: Connection) => connection.model(USER_SCHEMA_NAME, UserSchema),
        inject: [MONGODB_PROVIDER_NAME],
    },
];
