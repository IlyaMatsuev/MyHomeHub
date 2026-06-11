import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from 'common/dto';
import { RegistrationRequestStatus } from 'auth/interfaces';

@ApiSchema({ name: 'Auth.GetRegistrationRequests', description: 'Query parameters for fetching registration requests' })
export class GetRegistrationRequestsDto extends PaginationDto {
    @IsOptional()
    @IsEnum(RegistrationRequestStatus)
    @ApiProperty({
        required: false,
        description: 'Filter registration requests by status',
        enum: RegistrationRequestStatus,
    })
    status?: RegistrationRequestStatus;
}
