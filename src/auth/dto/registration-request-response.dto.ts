import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { RegistrationRequestStatus, RegistrationRequest } from 'auth/interfaces';

@ApiSchema({ name: 'Auth.RegistrationRequestResponse', description: 'The registration request details' })
export class RegistrationRequestResponseDto {
    @ApiProperty({ description: 'The unique external ID of the registration request', example: 'f3cec07c-9834-4a02-990d-28b0d99534ab' })
    externalId: string;

    @ApiProperty({ description: 'The email of the user who requested registration', example: 'user@example.com' })
    userEmail: string;

    @ApiProperty({
        description: 'The current status of the registration request',
        enum: RegistrationRequestStatus,
        example: RegistrationRequestStatus.PENDING,
    })
    status: RegistrationRequestStatus;

    @ApiProperty({ description: 'Optional comment provided by the user', example: 'Please approve my account', required: false })
    comment?: string;

    @ApiProperty({ description: 'When the registration request was created' })
    createdAt: Date;

    @ApiProperty({ description: 'When the registration request was last updated' })
    updatedAt: Date;

    constructor(request: RegistrationRequest) {
        this.externalId = request.externalId;
        this.userEmail = request.userEmail;
        this.status = request.status;
        this.comment = request.comment;
        this.createdAt = request.createdAt;
        this.updatedAt = request.updatedAt;
    }
}
