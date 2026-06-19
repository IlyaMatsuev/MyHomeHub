import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiInternalError, ApiUnauthorized } from 'common/decorators';
import { UsersService } from 'users/users.service';
import { UserRole } from 'users/interfaces';
import { UserResponseDto } from 'users/dto';
import { CurrentUser, ForRoles } from 'auth/decorators';
import { AuthenticatedUser } from 'auth/interfaces';

@Controller('users')
@ApiBearerAuth()
@ApiUnauthorized()
@ApiInternalError()
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    @ForRoles(UserRole.Resident, UserRole.Guest)
    @ApiOperation({ summary: 'Get the details of the currently logged in user' })
    @ApiOkResponse({ type: UserResponseDto })
    async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
        return new UserResponseDto(await this.usersService.getUserByExternalId(user.userId));
    }
}
