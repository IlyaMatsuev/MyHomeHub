import { Param, ParseUUIDPipe } from '@nestjs/common';
import { EXTERNAL_ID_UUID_VERSION } from 'common/common.constants';
import { FieldValidationException } from 'common/exceptions';

/**
 * Binds an `externalId` route param and validates it as a UUID at the request level.
 */
export const ExternalIdParam = (param = 'externalId'): ParameterDecorator =>
    Param(
        param,
        new ParseUUIDPipe({
            version: EXTERNAL_ID_UUID_VERSION,
            exceptionFactory: () => new FieldValidationException(`${param} must be a valid UUID`, param),
        }),
    );
