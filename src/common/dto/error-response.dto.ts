import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

@ApiSchema({ name: 'Common.ErrorMessageDetails', description: 'A single validation error' })
export class ErrorMessageDetailsDto {
    @ApiProperty({ description: 'Human-readable error message', example: 'name must be longer than or equal to 3 characters' })
    message: string;

    @ApiProperty({ description: 'Dot-separated path to the invalid field in the request', example: 'name', required: false })
    path: string;
}

@ApiSchema({ name: 'Common.ErrorDetails' })
export class ErrorDetailsDto {
    @ApiProperty({ type: ErrorMessageDetailsDto, isArray: true })
    errors: Array<ErrorMessageDetailsDto>;
}

@ApiSchema({ name: 'Common.ErrorResponse', description: 'Standard error response' })
export class ErrorResponseDto {
    @ApiProperty({ type: String, isArray: true, example: ['name must be longer than or equal to 3 characters'] })
    messages: Array<string>;

    @ApiProperty({ type: ErrorDetailsDto })
    details: ErrorDetailsDto;

    @ApiProperty({ enum: HttpStatus, example: 400 })
    statusCode: HttpStatus;
}
