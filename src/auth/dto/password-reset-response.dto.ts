import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Auth.PasswordResetResponse', description: 'The result of a successful password reset' })
export class PasswordResetResponseDto {
    @ApiProperty({ description: 'The short-lived token used to confirm the password change' })
    resetToken: string;
}
