import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { REGISTRATION_REQUEST_COMMENT_MAX_LENGTH } from 'auth/auth.constants';

@ApiSchema({ name: 'Auth.CreateRegistrationRequest', description: 'Payload used to create a new registration request' })
export class CreateRegistrationRequestDto {
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({
        required: true,
        description: 'The email address of the user who wants to register',
        example: 'user@example.com',
    })
    email: string;

    @IsOptional()
    @IsString()
    @MaxLength(REGISTRATION_REQUEST_COMMENT_MAX_LENGTH)
    @ApiProperty({
        required: false,
        description: 'Optional comment to provide additional information to the admin',
        maxLength: REGISTRATION_REQUEST_COMMENT_MAX_LENGTH,
        example: 'Please approve my account',
    })
    comment?: string;
}
