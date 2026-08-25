import { ConflictException } from '@nestjs/common';
import { ValidationError } from 'common/interfaces';

/**
 * A 409 that carries a field-level error in the same shape as class-validator failures:
 * `{ messages, details: { errors: [{ message, path }] } }`.
 *
 * Use it when the request conflicts with an existing resource - e.g. a registration request
 * for the same email already exists (`path: 'email'`)
 */
export class FieldConflictException extends ConflictException {
    constructor(message: string, path?: string) {
        const error: ValidationError = path ? { message, path } : { message };
        super({
            messages: [message],
            details: { errors: [error] },
        });
    }
}
