import { ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { ValidationErrorResponseDto } from 'common/dto/validation-error-response.dto';
import { HttpStatus } from '@nestjs/common';

export const ApiUnauthorized = () =>
    ApiUnauthorizedResponse({
        type: ErrorResponseDto,
        example: { message: 'Unauthorized', statusCode: HttpStatus.UNAUTHORIZED },
    });

export const ApiNotFound = (resource: string) =>
    ApiNotFoundResponse({
        type: ErrorResponseDto,
        example: { message: `There is no ${resource} matching these criteria`, statusCode: HttpStatus.NOT_FOUND },
    });

export const ApiInternalError = () =>
    ApiInternalServerErrorResponse({
        type: ErrorResponseDto,
        example: { message: 'Internal server error', statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
    });

export const ApiValidationError = () =>
    ApiBadRequestResponse({
        type: ValidationErrorResponseDto,
        example: {
            messages: ['name must be longer than or equal to 3 characters'],
            details: {
                errors: [{ message: 'name must be longer than or equal to 3 characters', path: 'name' }],
            },
            statusCode: HttpStatus.BAD_REQUEST,
        },
    });
