import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'common/interfaces';

/**
 * A 400 that carries a field-level error in the same shape as class-validator failures:
 * `{ messages, details: { errors: [{ message, path }] } }`.
 *
 * Use it when you want to point the client at a specific field - e.g. a uniqueness conflict (`path: 'email'`)
 */
export class FieldValidationException extends BadRequestException {
    constructor(message: string, path?: string) {
        const error: ValidationError = path ? { message, path } : { message };
        super({
            messages: [message],
            details: { errors: [error] },
        });
    }
}
