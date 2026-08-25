import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

@ApiSchema({
    name: 'Auth.GoogleLogin',
    description: 'Payload carrying a Google ID token obtained by the client from the Google Sign-In SDK',
})
export class GoogleLoginDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        description: 'The ID token (JWT) issued by Google for one of the client IDs configured on this server',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFiZDY4NSJ9...',
    })
    idToken: string;
}
