import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { RegistrationRequestStatus, RegistrationRequest, UserRole } from 'users/interfaces';
import { DEFAULT_USER_ROLE, REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED } from 'users/users.constants';

@ApiSchema({ name: 'Auth.RegistrationRequestResponse', description: 'The registration request details' })
export class RegistrationRequestResponseDto {
    @ApiProperty({ description: 'The unique external ID of the registration request', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    externalId: string;

    @ApiProperty({ description: 'The email of the user who requested registration', example: 'user@example.com' })
    requesterEmail: string;

    @ApiProperty({
        description: 'The current status of the registration request',
        enum: RegistrationRequestStatus,
        example: RegistrationRequestStatus.Pending,
    })
    status: RegistrationRequestStatus;

    @ApiProperty({
        description: 'The role that will be assigned to the user once the registration request is approved',
        enum: UserRole,
        example: DEFAULT_USER_ROLE,
    })
    role: UserRole;

    @ApiProperty({ description: 'Optional comment provided by the requester', example: 'Please approve my account', required: false })
    requesterComment?: string;

    @ApiProperty({
        description: 'If true, future registration requests from this email will be automatically rejected',
        example: REGISTRATION_REQUEST_DEFAULT_BLACK_LISTED,
    })
    blackListed: boolean;

    @ApiProperty({ description: 'When the registration request was created (Unix epoch in seconds)' })
    createdAt: number;

    @ApiProperty({ description: 'When the registration request was last updated (Unix epoch in seconds)' })
    updatedAt: number;

    constructor(request: RegistrationRequest) {
        this.externalId = request.externalId;
        this.requesterEmail = request.requesterEmail;
        this.requesterComment = request.requesterComment;
        this.status = request.status;
        this.role = request.role;
        this.blackListed = request.blackListed;
        this.createdAt = request.createdAt?.getTime();
        this.updatedAt = request.updatedAt?.getTime();
    }
}
