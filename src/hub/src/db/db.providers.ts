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
            const dbDomain = configService.get<string>('MONGO_DOMAIN');
            const dbPort = configService.get<string>('MONGO_PORT');
            const connectionUrl = `mongodb://${username}:${password}@${dbDomain}/${dbName}:${dbPort}?authSource=admin`;
            return mongoose.connect(connectionUrl);
        },
        inject: [ConfigService],
    },
];
