import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

@ApiSchema({ name: 'Common.ValidationError', description: 'A single validation error' })
export class ValidationErrorDto {
    @ApiProperty({ description: 'Human-readable error message', example: 'name must be longer than or equal to 3 characters' })
    message: string;

    @ApiProperty({ description: 'Dot-separated path to the invalid field in the request', example: 'name' })
    path: string;
}

@ApiSchema({ name: 'Common.ValidationErrorDetails' })
export class ValidationErrorDetailsDto {
    @ApiProperty({ type: ValidationErrorDto, isArray: true })
    errors: Array<ValidationErrorDto>;
}

@ApiSchema({ name: 'Common.ValidationErrorResponse', description: 'Error response returned when request body/query fails validation' })
export class ValidationErrorResponseDto {
    @ApiProperty({ type: String, isArray: true, example: ['name must be longer than or equal to 3 characters'] })
    messages: Array<string>;

    @ApiProperty({ type: ValidationErrorDetailsDto })
    details: ValidationErrorDetailsDto;

    @ApiProperty({ enum: HttpStatus, example: 400 })
    statusCode: HttpStatus;
}
