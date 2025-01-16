import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'LoginRequest', description: 'Payload used to login and get an access token used for authentication' })
export class LoginDto {
    @ApiProperty({
        required: true,
        description: 'User email used during the registration',
        example: 'some.email@example.com',
    })
    email: string;

    @ApiProperty({
        required: true,
        description: 'User password used during the registration',
        minLength: 4,
        maxLength: 20,
    })
    password: string;
}
