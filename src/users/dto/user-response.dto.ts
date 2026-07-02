import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { User, UserRole } from 'users/interfaces';
import { DEFAULT_USER_ROLE } from 'users/users.constants';

@ApiSchema({ name: 'Users.UserResponse', description: 'User entity returned in API responses' })
export class UserResponseDto {
    @ApiProperty({ description: 'Unique external identifier', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    externalId: string;

    @ApiProperty({ description: 'The email of the user' })
    email: string;

    @ApiProperty({ description: 'The role of the user', enum: UserRole, example: DEFAULT_USER_ROLE })
    role: UserRole;

    constructor(user: Partial<User>) {
        this.externalId = user.externalId;
        this.email = user.email;
        this.role = user.role;
    }
}
