import { FieldValidationException } from './field-validation.exception';

describe('FieldValidationException', () => {
    it('should build the messages/details shape for a message with a path', () => {
        const exception = new FieldValidationException('name already exists', 'name');

        expect(exception.getStatus()).toBe(400);
        expect(exception.getResponse()).toEqual({
            messages: ['name already exists'],
            details: { errors: [{ message: 'name already exists', path: 'name' }] },
        });
    });

    it('should omit the path when it is not provided', () => {
        const exception = new FieldValidationException('Something is wrong');

        expect(exception.getResponse()).toEqual({
            messages: ['Something is wrong'],
            details: { errors: [{ message: 'Something is wrong' }] },
        });
    });
});
