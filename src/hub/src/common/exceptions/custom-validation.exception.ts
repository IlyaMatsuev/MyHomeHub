import { ValidationError } from 'common/interfaces';

export class CustomValidationException extends Error {
    private readonly errors: Array<ValidationError>;

    constructor(...errors: Array<ValidationError>) {
        super(errors[0].message);
        this.name = CustomValidationException.name;
        this.errors = errors;
    }

    getMessages(): Array<string> {
        return this.errors.map(e => e.message);
    }

    getErrors(): Array<ValidationError> {
        return this.errors;
    }
}
