import { applyDecorators } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Use this decorator for Query params DTO.
 * String "true" and "1" will be converted as `true`. Otherwise, `false`
 */
export const IsBooleanValue = () => {
    return applyDecorators(
        IsBoolean(),
        // "false" is implicitly converted to boolean before @Transform, so it's always true. Hence, the explicit String type
        Type(() => String),
        Transform(({ value }) => value === 'true' || value === '1' || value === true),
    );
};
