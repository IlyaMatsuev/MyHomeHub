import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, RolesGuard } from 'auth/guards';
import { JwtStrategy } from 'auth/strategies';
import { RegistrationRequestsController } from 'auth/registration-requests.controller';
import { UsersModule } from 'users/users.module';
import { AuthConfigService } from 'auth/auth-config.service';
import { CookiesConfigService } from 'auth/cookies/cookies-config.service';

@Module({
    imports: [
        UsersModule,
        PassportModule,
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
        AuthConfigService,
        CookiesConfigService,
        AuthService,
        JwtStrategy,
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
    ],
})
export class AuthModule {}
