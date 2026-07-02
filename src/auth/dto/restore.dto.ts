import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

@ApiSchema({ name: 'Auth.Restore', description: 'Payload used to request a password restore token' })
export class RestoreDto {
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({
        description: 'Email of the user whose password needs to be restored',
        example: 'some.email@example.com',
    })
    email: string;

    @IsNotEmpty()
    @Matches(/^\d{6}$/)
    @ApiProperty({
        description: 'The one-time password from the admins authenticator app used to confirm the restore request',
        example: '123456',
    })
    totp: string;
}
