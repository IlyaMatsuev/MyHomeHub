import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from 'auth/auth.module';
import { UsersModule } from 'users/users.module';
import { DevicesModule } from 'devices/devices.module';

@Module({
    imports: [
        AuthModule,
        UsersModule,
        DevicesModule,
        ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env.${process.env.NODE_ENV}` })
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
