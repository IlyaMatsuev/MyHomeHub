import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from 'auth/auth.guard';
import { RegistrationRequestsController } from 'auth/registration-requests.controller';
import { RegistrationRequestsService } from 'auth/registration-requests.service';
import { authProviders } from 'auth/auth.providers';
import { UsersModule } from 'users/users.module';
import { DatabaseModule } from 'db/db.module';

@Module({
    imports: [
        UsersModule,
        DatabaseModule,
        JwtModule.registerAsync({
            global: true,
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: Number(configService.get('JWT_EXPIRATION_TIMEOUT')) },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController, RegistrationRequestsController],
    providers: [
        AuthService,
        RegistrationRequestsService,
        ...authProviders,
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
    ],
})
export class AuthModule {}
