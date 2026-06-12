import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

@ApiSchema({ name: 'Auth.UpdateRegistrationRequest', description: 'Payload used to approve or reject a registration request' })
export class UpdateRegistrationRequestDto {
    @IsBoolean()
    @IsNotEmpty()
    @ApiProperty({
        required: true,
        description: 'Whether to approve (true) or reject (false) the registration request',
        example: true,
    })
    approve: boolean;

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        required: false,
        default: false,
        description: 'If true, future registration requests from this email will be automatically denied',
        example: false,
    })
    blackListed?: boolean;
}
