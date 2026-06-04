import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiInternalError, ApiUnauthorized } from 'common/decorators';
import { LoginDto, RegisterDto, LoginResponseDto, RegisterResponseDto } from 'auth/dto';
import { AuthService } from 'auth/auth.service';
import { Public } from 'auth/decorators';

@Controller('auth')
@ApiUnauthorized()
@ApiInternalError()
export class AuthController {
    constructor(private authService: AuthService) {}

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get access token using registered user credentials' })
    @ApiOkResponse({ type: LoginResponseDto })
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<LoginResponseDto> {
        const { accessToken } = await this.authService.login(loginDto.email, loginDto.password);
        response.cookie('accessToken', accessToken, { httpOnly: true });
        return { accessToken };
    }

    @Public()
    @Post('register')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register a new user' })
    @ApiOkResponse({ type: RegisterResponseDto })
    register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
        return this.authService.register(registerDto.email, registerDto.password, registerDto.totp);
    }
}
