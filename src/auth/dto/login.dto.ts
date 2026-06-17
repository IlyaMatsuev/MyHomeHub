import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

@ApiSchema({ name: 'Auth.Login', description: 'Payload used to login and get an access token used for authentication' })
export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    @ApiPropertyOptional({
        description: 'User email used during the registration. Required when no refreshToken is provided',
        example: 'some.email@example.com',
    })
    email?: string;

    @IsNotEmpty()
    @ApiPropertyOptional({ description: 'User password used during the registration. Required when no refreshToken is provided' })
    password?: string;
}
