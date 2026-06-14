import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Auth.LoginResponse', description: 'The result of a successful login attempt' })
export class LoginResponseDto {
    @ApiProperty({ description: 'The user JWT token used for authentication' })
    accessToken: string;

    @ApiProperty({ description: 'The token used to obtain a new access token without providing the credentials again' })
    refreshToken: string;
}
