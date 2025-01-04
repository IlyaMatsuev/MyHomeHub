import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LoginDto } from 'auth/dto';
import { AuthService } from 'auth/auth.service';
import { LoginResult } from 'auth/interfaces';
import { Public } from 'auth/decorators';

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
}
