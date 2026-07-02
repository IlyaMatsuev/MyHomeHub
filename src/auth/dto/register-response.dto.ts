import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { UserRole } from 'users/interfaces';
import { DEFAULT_USER_ROLE } from 'users/users.constants';

@ApiSchema({ name: 'Auth.RegisterResponse', description: 'The result of a successful user registration' })
export class RegisterResponseDto {
    @ApiProperty({ description: 'External, opaque identifier of the newly registered user' })
    externalId: string;

    @ApiProperty({ description: 'The email of the newly registered user' })
    email: string;

    @ApiProperty({ description: 'The role assigned to the user', enum: UserRole, example: DEFAULT_USER_ROLE })
    role: UserRole;
}
