import { HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Common.ErrorResponse', description: 'Standard error response' })
export class ErrorResponseDto {
    @ApiProperty({ description: 'Human-readable error message', example: 'Unauthorized' })
    message: string;

    @ApiProperty({ enum: HttpStatus, description: 'HTTP status code', example: HttpStatus.UNAUTHORIZED })
    statusCode: HttpStatus;
}
