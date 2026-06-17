import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsString } from 'class-validator';

@ApiSchema({
    name: 'Auth.LoginRefresh',
    description: 'Payload used to login and get an access token used for authentication using the refresh token',
})
export class LoginRefreshDto {
    @IsString()
    @ApiPropertyOptional({
        description: 'Refresh token used to obtain a new access token without providing the credentials again',
    })
    refreshToken: string;
}
