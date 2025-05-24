import { ValidationError } from 'common/interfaces';
import { ValidationError as ClassValidationError } from 'class-validator/types/validation/ValidationError';

export class CustomValidationException extends Error {
    private readonly errors: Array<ValidationError>;

    constructor(...errors: Array<ValidationError>) {
        super(errors[0].message);
        this.name = CustomValidationException.name;
        this.errors = errors;
    }

    static fromClassValidator(validationErrors: Array<ClassValidationError>) {
        const transformErrors = (target: ClassValidationError, paths: Array<string>): Array<ValidationError> => {
            paths.push(target.property);

            if (target.constraints) {
                const messages = Object.entries(target.constraints).map(([, message]) => message);
                const path = paths.join('.');
                return messages.map(m => ({ message: m, path, value: target.value }));
            }
            return target.children.reduce((result, child) => {
                result.push(...transformErrors(child, paths));
                return result;
            }, []);
        };

        const transformedErrors: Array<ValidationError> = validationErrors.reduce((transformedErrors, error) => {
            transformedErrors.push(...transformErrors(error, []));
            return transformedErrors;
        }, []);
        return new CustomValidationException(...transformedErrors);
    }

    getMessages(): Array<string> {
        return this.errors.map(e => e.message);
    }

    getErrors(): Array<ValidationError> {
        return this.errors;
    }
}
