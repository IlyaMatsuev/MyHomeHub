import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { ExceptionHandler } from 'common/interfaces';
import { CustomValidationException } from 'common/exceptions';

export class CustomValidationExceptionHandler implements ExceptionHandler<CustomValidationException> {
    getExceptionType(): new (...args: Array<unknown>) => CustomValidationException {
        return CustomValidationException;
    }

    handleException(exception: CustomValidationException, context: ExecutionContext): void | never {
        if (exception.name === 'CustomValidationException') {
            if (context.getType() === 'http') {
                throw new BadRequestException({
                    messages: exception.getMessages(),
                    details: {
                        errors: exception.getErrors(),
                    },
                });
            }
        }
    }
}
