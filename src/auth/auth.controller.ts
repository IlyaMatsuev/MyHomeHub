import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { LoginDto, RegisterDto } from 'auth/dto';
import { AuthService } from 'auth/auth.service';
import { LoginResult } from 'auth/interfaces';
import { Public } from 'auth/decorators';
import { NewUser } from 'users/interfaces';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get access token using registered user credentials' })
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<LoginResult> {
        const { accessToken } = await this.authService.login(loginDto.email, loginDto.password);
        response.cookie('accessToken', accessToken, { httpOnly: true });
        return { accessToken };
    }

    @Public()
    @Post('register')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register a new user' })
    register(@Body() registerDto: RegisterDto): Promise<NewUser> {
        return this.authService.register(registerDto.email, registerDto.password, registerDto.totp);
    }
}
