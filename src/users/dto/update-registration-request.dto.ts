import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED } from 'users/users.constants';

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
    // "false" is implicitly converted to boolean before @Transform, so it's always true. Hence, the explicit String type
    @Type(() => String)
    @Transform(({ value }) => value === 'true' || value === '1' || value === true)
    @ApiProperty({
        required: false,
        default: REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED,
        description: 'If true, future registration requests from this email will be automatically denied',
        example: REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED,
    })
    blackListed?: boolean = REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED;
}
