import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { IsBooleanValue } from 'common/decorators';
import { UserRole } from 'users/interfaces';
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
    @IsBooleanValue()
    @ApiProperty({
        required: false,
        default: REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED,
        description: 'If true, future registration requests from this email will be automatically denied',
        example: REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED,
    })
    blackListed?: boolean = REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED;

    @IsOptional()
    @IsEnum(UserRole)
    @ApiProperty({
        required: false,
        enum: UserRole,
        description: 'The role to assign to the user once the registration request is approved',
        example: UserRole.Resident,
    })
    role?: UserRole;
}
