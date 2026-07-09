import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from 'common/dto/error-response.dto';
import { HttpStatus } from '@nestjs/common';

export const ApiUnauthorized = () =>
    ApiUnauthorizedResponse({
        type: ErrorResponseDto,
        example: {
            messages: ['Unauthorized'],
            details: {
                errors: [{ message: 'Unauthorized' }],
            },
            statusCode: HttpStatus.UNAUTHORIZED,
        },
    });

export const ApiForbidden = () =>
    ApiForbiddenResponse({
        type: ErrorResponseDto,
        example: {
            messages: ['Forbidden'],
            details: {
                errors: [{ message: 'Forbidden' }],
            },
            statusCode: HttpStatus.FORBIDDEN,
        },
    });

export const ApiNotFound = (resource: string) =>
    ApiNotFoundResponse({
        type: ErrorResponseDto,
        example: {
            messages: [`There is no ${resource} matching these criteria`],
            details: {
                errors: [{ message: `There is no ${resource} matching these criteria` }],
            },
            statusCode: HttpStatus.NOT_FOUND,
        },
    });

export const ApiConflict = (message: string, path?: string) =>
    ApiConflictResponse({
        type: ErrorResponseDto,
        example: {
            messages: [message],
            details: {
                errors: [path ? { message, path } : { message }],
            },
            statusCode: HttpStatus.CONFLICT,
        },
    });

export const ApiInternalError = () =>
    ApiInternalServerErrorResponse({
        type: ErrorResponseDto,
        example: {
            messages: ['Internal server error'],
            details: {
                errors: [{ message: 'Internal server error' }],
            },
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        },
    });

export const ApiValidationError = () =>
    ApiBadRequestResponse({
        type: ErrorResponseDto,
        example: {
            messages: ['name must be longer than or equal to 3 characters'],
            details: {
                errors: [{ message: 'name must be longer than or equal to 3 characters', path: 'name' }],
            },
            statusCode: HttpStatus.BAD_REQUEST,
        },
    });
