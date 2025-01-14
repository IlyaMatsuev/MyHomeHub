import * as mongoose from 'mongoose';
import { MONGODB_PROVIDER_NAME } from 'db/db.constants';
import { ConfigService } from '@nestjs/config';

export const databaseProviders = [
    {
        provide: MONGODB_PROVIDER_NAME,
        useFactory: (configService: ConfigService): Promise<typeof mongoose> => {
            const username = configService.get<string>('MONGO_INITDB_ROOT_USERNAME');
            const password = configService.get<string>('MONGO_INITDB_ROOT_PASSWORD');
            const dbName = configService.get<string>('MONGO_INITDB_DATABASE');
            const connectionUrl = `mongodb://${username}:${password}@127.0.0.1/${dbName}?authSource=admin`;
            return mongoose.connect(connectionUrl);
        },
        inject: [ConfigService],
    },
];