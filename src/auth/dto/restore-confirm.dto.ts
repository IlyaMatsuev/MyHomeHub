import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { USER_PASSWORD_MAX_LENGTH, USER_PASSWORD_MIN_LENGTH } from 'users/users.constants';

@ApiSchema({
    name: 'Auth.RestoreConfirm',
    description: 'Payload used to confirm a password restore request and set a new password',
})
export class RestoreConfirmDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: 'The restore token received from the GET /auth/restore endpoint' })
    restoreToken: string;

    @MinLength(USER_PASSWORD_MIN_LENGTH)
    @MaxLength(USER_PASSWORD_MAX_LENGTH)
    @IsNotEmpty()
    @ApiProperty({
        description: 'The new password to be set for the user',
        minLength: USER_PASSWORD_MIN_LENGTH,
        maxLength: USER_PASSWORD_MAX_LENGTH,
    })
    password: string;
}
