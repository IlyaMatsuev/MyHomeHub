import { ApiProperty, ApiSchema } from '@nestjs/swagger';

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
        minLength: 4,
        maxLength: 20,
    })
    password: string;

    @ApiProperty({
        required: true,
        description: 'Secret access key that is required to be able to register and get access to the Hub API',
        example: '1234567890',
    })
    accessKey: string;
}
