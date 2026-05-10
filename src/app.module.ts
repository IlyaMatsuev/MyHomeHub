import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from 'common/common.module';
import { AuthModule } from 'auth/auth.module';
import { UsersModule } from 'users/users.module';
import { DevicesModule } from 'devices/devices.module';
import { ScenariosModule } from 'scenarios/scenarios.module';
import { MqttModule } from 'mqtt/mqtt.module';

@Module({
    imports: [
        CommonModule,
        AuthModule,
        UsersModule,
        DevicesModule,
        ScenariosModule,
        MqttModule,

        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot(),
        ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env` }),
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
