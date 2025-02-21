import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from 'common/common.module';
import { AuthModule } from 'auth/auth.module';
import { UsersModule } from 'users/users.module';
import { DevicesModule } from 'devices/devices.module';
import { ScenariosModule } from 'scenarios/scenarios.module';

@Module({
    imports: [
        CommonModule,
        AuthModule,
        UsersModule,
        DevicesModule,
        ScenariosModule,

        ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env.${process.env.NODE_ENV}` }),
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
