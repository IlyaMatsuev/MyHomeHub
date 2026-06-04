import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Auth.RegisterResponse', description: 'The result of a successful user registration' })
export class RegisterResponseDto {
    @ApiProperty({ description: 'The email of the newly registered user' })
    email: string;
}
