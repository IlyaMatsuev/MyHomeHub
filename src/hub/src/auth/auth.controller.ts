import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LoginDto, RegisterDto } from 'auth/dto';
import { AuthService } from 'auth/auth.service';
import { LoginResult } from 'auth/interfaces';
import { Public } from 'auth/decorators';
import { NewUser } from 'users/interfaces';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @HttpCode(HttpStatus.OK)
    @Public()
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<LoginResult> {
        const { accessToken } = await this.authService.login(loginDto.email, loginDto.password);
        response.cookie('accessToken', accessToken, { httpOnly: true });
        return { accessToken };
    }

    @HttpCode(HttpStatus.OK)
    @Public()
    @Post('register')
    register(@Body() registerDto: RegisterDto): Promise<NewUser> {
        return this.authService.register(registerDto.email, registerDto.password, registerDto.accessKey);
    }
}
