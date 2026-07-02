import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiForbidden, ApiInternalError, ApiUnauthorized, ApiValidationError } from 'common/decorators';
import { Public } from 'auth/decorators';
import { WithCookies } from 'auth/cookies/decorators';
import {
    LoginDto,
    RegisterDto,
    LoginResponseDto,
    RegisterResponseDto,
    LoginRefreshDto,
    RestoreDto,
    RestoreResponseDto,
    RestoreConfirmDto,
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
    @WithCookies(LoginResponseDto, 'accessToken', 'refreshToken')
    @ApiOperation({ summary: 'Get an access token using registered user credentials' })
    @ApiOkResponse({ type: LoginResponseDto })
    @ApiValidationError()
    async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
        return this.authService.login(loginDto.email, loginDto.password);
    }

    @Put('login/refresh')
    @WithCookies(LoginResponseDto, 'accessToken', 'refreshToken')
    @ApiOperation({ summary: 'Get an access token using a refresh token' })
    @ApiOkResponse({ type: LoginResponseDto })
    @ApiValidationError()
    async loginWithToken(@Body() refreshDto: LoginRefreshDto): Promise<LoginResponseDto> {
        return this.authService.refreshToken(refreshDto.refreshToken);
    }

    @Post('register')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register a new user' })
    @ApiOkResponse({ type: RegisterResponseDto })
    @ApiValidationError()
    @ApiForbidden()
    register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
        return this.authService.register(registerDto.email, registerDto.password, registerDto.totp);
    }

    @Get('restore')
    @ApiOperation({ summary: 'Request a password restore token by confirming identity with admin TOTP' })
    @ApiOkResponse({ type: RestoreResponseDto })
    @ApiValidationError()
    @ApiForbidden()
    restore(@Query() restoreDto: RestoreDto): Promise<RestoreResponseDto> {
        return this.authService.restore(restoreDto.email, restoreDto.totp);
    }

    @Post('restore/confirm')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Confirm a password restore request and set a new password' })
    @ApiOkResponse({ description: 'Password successfully updated' })
    @ApiValidationError()
    async confirmRestore(@Body() confirmDto: RestoreConfirmDto): Promise<void> {
        await this.authService.confirmRestore(confirmDto.restoreToken, confirmDto.password);
    }
}
