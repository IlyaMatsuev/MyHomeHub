import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, LocalNetworkGuard, RolesGuard } from 'auth/guards';
import { JwtStrategy } from 'auth/strategies';
import { RegistrationRequestsController } from 'auth/registration-requests.controller';
import { GoogleAuthController } from 'auth/google-auth.controller';
import { UsersModule } from 'users/users.module';
import { AuthConfigService } from 'auth/auth-config.service';
import { CookiesConfigService } from 'auth/cookies/cookies-config.service';
import { PasswordResetTokensService } from 'auth/password-reset-tokens.service';
import { GoogleAuthService } from 'auth/google-auth.service';
import { GoogleTokenVerifierService } from 'auth/google-token-verifier.service';
import { authProviders } from 'auth/auth.providers';

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
    controllers: [AuthController, RegistrationRequestsController, GoogleAuthController],
    providers: [
        AuthConfigService,
        CookiesConfigService,
        AuthService,
        PasswordResetTokensService,
        GoogleAuthService,
        GoogleTokenVerifierService,
        JwtStrategy,
        {
            provide: APP_GUARD,
            useClass: LocalNetworkGuard,
        },
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
        ...authProviders,
    ],
})
export class AuthModule {}
