import { Body, Controller, Delete, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiConflict, ApiInternalError, ApiNotFound, ApiUnauthorized, ApiValidationError } from 'common/decorators';
import { CurrentUser, ForRoles, Public } from 'auth/decorators';
import { WithCookies } from 'auth/cookies/decorators';
import { AuthenticatedUser } from 'auth/interfaces';
import { StrictThrottle } from 'throttler/decorators';
import { GoogleLoginDto, LoginResponseDto } from 'auth/dto';
import { GoogleAuthService } from 'auth/google-auth.service';
import { UserResponseDto } from 'users/dto';
import { UserRole } from 'users/interfaces';

@Controller('auth/google')
@ApiTags('Auth')
@ApiUnauthorized()
@ApiInternalError()
export class GoogleAuthController {
    constructor(private readonly googleAuthService: GoogleAuthService) {}

    @Public()
    @Put('login')
    @StrictThrottle('googleLogin')
    @WithCookies(LoginResponseDto, 'accessToken', 'refreshToken')
    @ApiOperation({
        summary: 'Get an access token using a Google account',
        description:
            'Signs in the owner of the Google account the ID token was issued for. ' +
            'A new user is registered when the account email has an approved registration request, ' +
            'and an existing user with the same email is linked to the Google account automatically.',
    })
    @ApiOkResponse({ type: LoginResponseDto })
    @ApiValidationError()
    @ApiConflict('This user is already linked to another Google account', 'idToken')
    loginWithGoogle(@Body() googleDto: GoogleLoginDto): Promise<LoginResponseDto> {
        return this.googleAuthService.login(googleDto.idToken);
    }

    @Post('link')
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @StrictThrottle('googleLink')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Link a Google account to the currently logged in user' })
    @ApiOkResponse({ type: UserResponseDto })
    @ApiValidationError()
    @ApiNotFound('user')
    @ApiConflict('This Google account is already linked to another user', 'idToken')
    async linkGoogleAccount(@CurrentUser() user: AuthenticatedUser, @Body() googleDto: GoogleLoginDto): Promise<UserResponseDto> {
        return new UserResponseDto(await this.googleAuthService.linkAccount(user.userId, googleDto.idToken));
    }

    @Delete('link')
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @StrictThrottle('googleLink')
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Unlink the Google account from the currently logged in user',
        description: 'Only allowed when the user has a password set, otherwise there would be no way left to sign in',
    })
    @ApiOkResponse({ type: UserResponseDto })
    @ApiValidationError()
    @ApiNotFound('user')
    async unlinkGoogleAccount(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
        return new UserResponseDto(await this.googleAuthService.unlinkAccount(user.userId));
    }
}
