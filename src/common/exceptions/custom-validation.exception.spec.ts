import { CustomValidationException } from './custom-validation.exception';
import { ValidationError as ClassValidationError } from 'class-validator';

describe('CustomValidationException', () => {
    describe('constructor', () => {
        it('should create exception with single error', () => {
            const exception = new CustomValidationException({
                message: 'Field is required',
                path: 'name',
                value: undefined,
            });

            expect(exception.message).toBe('Field is required');
            expect(exception.name).toBe('CustomValidationException');
            expect(exception.getErrors()).toHaveLength(1);
        });

        it('should create exception with multiple errors', () => {
            const exception = new CustomValidationException(
                { message: 'Name is required', path: 'name', value: undefined },
                { message: 'Email is invalid', path: 'email', value: 'invalid' },
            );

            expect(exception.getErrors()).toHaveLength(2);
            expect(exception.getMessages()).toEqual(['Name is required', 'Email is invalid']);
        });
    });

    describe('fromClassValidator', () => {
        it('should transform class-validator errors', () => {
            const classValidatorErrors: Array<ClassValidationError> = [
                {
                    property: 'name',
                    value: '',
                    constraints: {
                        isNotEmpty: 'name should not be empty',
                        minLength: 'name must be at least 3 characters',
                    },
                    children: [],
                },
            ];

            const exception = CustomValidationException.fromClassValidator(classValidatorErrors);

            expect(exception.getErrors()).toHaveLength(2);
            expect(exception.getMessages()).toContain('name should not be empty');
            expect(exception.getMessages()).toContain('name must be at least 3 characters');
        });

        it('should handle nested errors', () => {
            const classValidatorErrors: Array<ClassValidationError> = [
                {
                    property: 'controls',
                    value: { on: 'invalid' },
                    constraints: undefined,
                    children: [
                        {
                            property: 'on',
                            value: 'invalid',
                            constraints: {
                                isBoolean: 'on must be a boolean value',
                            },
                            children: [],
                        },
                    ],
                },
            ];

            const exception = CustomValidationException.fromClassValidator(classValidatorErrors);
            const errors = exception.getErrors();

            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('controls.on');
            expect(errors[0].message).toBe('on must be a boolean value');
        });

        it('should handle deeply nested errors', () => {
            const classValidatorErrors: Array<ClassValidationError> = [
                {
                    property: 'trigger',
                    value: {},
                    constraints: undefined,
                    children: [
                        {
                            property: 'sources',
                            value: [],
                            constraints: undefined,
                            children: [
                                {
                                    property: '0',
                                    value: {},
                                    constraints: {
                                        isNotEmpty: 'cron should not be empty',
                                    },
                                    children: [],
                                },
                            ],
                        },
                    ],
                },
            ];

            const exception = CustomValidationException.fromClassValidator(classValidatorErrors);
            const errors = exception.getErrors();

            expect(errors).toHaveLength(1);
            expect(errors[0].path).toBe('trigger.sources.0');
        });
    });

    describe('getMessages', () => {
        it('should return array of error messages', () => {
            const exception = new CustomValidationException(
                { message: 'Error 1', path: 'field1', value: null },
                { message: 'Error 2', path: 'field2', value: null },
            );

            expect(exception.getMessages()).toEqual(['Error 1', 'Error 2']);
        });
    });

    describe('getErrors', () => {
        it('should return array of validation errors', () => {
            const errors = [
                { message: 'Error 1', path: 'field1', value: 'value1' },
                { message: 'Error 2', path: 'field2', value: 'value2' },
            ];
            const exception = new CustomValidationException(...errors);

            expect(exception.getErrors()).toEqual(errors);
        });
    });
});
