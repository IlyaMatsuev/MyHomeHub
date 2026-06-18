import { ApiSchema, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

@ApiSchema({ name: 'Auth.Login', description: 'Payload used to login and get an access token used for authentication' })
export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({
        description: 'User email used during the registration',
        example: 'some.email@example.com',
    })
    email: string;

    @IsNotEmpty()
    @ApiProperty({ description: 'User password used during the registration' })
    password: string;
}
