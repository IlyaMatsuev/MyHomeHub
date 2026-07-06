import { Body, Controller, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiForbidden, ApiInternalError, ApiUnauthorized, ApiValidationError } from 'common/decorators';
import { Public } from 'auth/decorators';
import { WithCookies } from 'auth/cookies/decorators';
import { StrictThrottle } from 'throttler/decorators';
import {
    LoginDto,
    RegisterDto,
    LoginResponseDto,
    RegisterResponseDto,
    LoginRefreshDto,
    PasswordResetDto,
    PasswordResetResponseDto,
    PasswordResetConfirmDto,
} from 'auth/dto';
import { AuthService } from 'auth/auth.service';

@Public()
@Controller('auth')
@ApiTags('Auth')
@ApiUnauthorized()
@ApiInternalError()
export class AuthController {
    constructor(private authService: AuthService) {}

    @Put('login')
    @StrictThrottle(5, 15 * 60)
    @WithCookies(LoginResponseDto, 'accessToken', 'refreshToken')
    @ApiOperation({ summary: 'Get an access token using registered user credentials' })
    @ApiOkResponse({ type: LoginResponseDto })
    @ApiValidationError()
    async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
        return this.authService.login(loginDto.email, loginDto.password);
    }

    @Put('login/refresh')
    @StrictThrottle(30, 5 * 60)
    @WithCookies(LoginResponseDto, 'accessToken', 'refreshToken')
    @ApiOperation({ summary: 'Get an access token using a refresh token' })
    @ApiOkResponse({ type: LoginResponseDto })
    @ApiValidationError()
    async loginWithToken(@Body() refreshDto: LoginRefreshDto): Promise<LoginResponseDto> {
        return this.authService.refreshToken(refreshDto.refreshToken);
    }

    @Post('register')
    @StrictThrottle(5, 60 * 60)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register a new user' })
    @ApiOkResponse({ type: RegisterResponseDto })
    @ApiValidationError()
    @ApiForbidden()
    register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
        return this.authService.register(registerDto.email, registerDto.password, registerDto.totp);
    }

    @Post('password/reset')
    @StrictThrottle(3, 60 * 60)
    @ApiOperation({ summary: 'Request a password reset token by confirming identity with admin TOTP' })
    @ApiOkResponse({ type: PasswordResetResponseDto })
    @ApiValidationError()
    @ApiForbidden()
    resetPassword(@Body() resetDto: PasswordResetDto): Promise<PasswordResetResponseDto> {
        return this.authService.requestPasswordReset(resetDto.email, resetDto.totp);
    }

    @Put('password/change')
    @StrictThrottle(5, 15 * 60)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Confirm a password change request and set a new password' })
    @ApiOkResponse({ description: 'Password successfully updated' })
    @ApiValidationError()
    async changePassword(@Body() changeDto: PasswordResetConfirmDto): Promise<void> {
        await this.authService.changePassword(changeDto.resetToken, changeDto.newPassword);
    }
}
