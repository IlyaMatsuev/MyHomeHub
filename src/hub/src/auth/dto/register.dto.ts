import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { USER_PASSWORD_MAX_LENGTH, USER_PASSWORD_MIN_LENGTH } from 'users/users.constants';

@ApiSchema({ name: 'RegisterRequest', description: 'Payload used to register a new user' })
export class RegisterDto {
    @ApiProperty({
        required: true,
        description: 'Unique user email, used for identifying only',
        example: 'some.email@example.com',
    })
    email: string;

    @ApiProperty({
        required: true,
        description: 'Password required for authorization',
        minLength: USER_PASSWORD_MIN_LENGTH,
        maxLength: USER_PASSWORD_MAX_LENGTH,
    })
    password: string;

    @ApiProperty({
        required: true,
        description: 'The one-time password from the admins authenticator app',
        example: '123456',
    })
    totp: string;
}
