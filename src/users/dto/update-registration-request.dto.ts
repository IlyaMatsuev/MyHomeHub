import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';
import { REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED } from 'users/users.constants';
import { IsBooleanValue } from 'common/decorators';

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
    @IsBooleanValue()
    @ApiProperty({
        required: false,
        default: REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED,
        description: 'If true, future registration requests from this email will be automatically denied',
        example: REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED,
    })
    blackListed?: boolean = REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED;
}
