import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Auth.RestoreResponse', description: 'The result of a successful password restore request' })
export class RestoreResponseDto {
    @ApiProperty({ description: 'The short-lived token used to confirm the password change' })
    restoreToken: string;
}
