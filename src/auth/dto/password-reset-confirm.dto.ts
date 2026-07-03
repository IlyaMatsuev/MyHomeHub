import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { USER_PASSWORD_MAX_LENGTH, USER_PASSWORD_MIN_LENGTH } from 'users/users.constants';

@ApiSchema({
    name: 'Auth.PasswordResetConfirm',
    description: 'Payload used to confirm a password reset request and set a new password',
})
export class PasswordResetConfirmDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: 'The token used to confirm the reset request' })
    resetToken: string;

    @MinLength(USER_PASSWORD_MIN_LENGTH)
    @MaxLength(USER_PASSWORD_MAX_LENGTH)
    @IsNotEmpty()
    @ApiProperty({
        description: 'The new password to be set for the user',
        minLength: USER_PASSWORD_MIN_LENGTH,
        maxLength: USER_PASSWORD_MAX_LENGTH,
    })
    newPassword: string;
}
