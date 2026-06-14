import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationResponseDto } from 'common/dto';

export const ApiOkPaginationResponse = <TModel extends Type<unknown>>(model: TModel, description?: string) => {
    return applyDecorators(
        ApiExtraModels(PaginationResponseDto, model),
        ApiOkResponse({
            description: description ?? `Paginated list of ${model.name}`,
            schema: {
                allOf: [
                    { $ref: getSchemaPath(PaginationResponseDto) },
                    {
                        properties: {
                            items: {
                                type: 'array',
                                items: { $ref: getSchemaPath(model) },
                            },
                        },
                    },
                ],
            },
        }),
    );
};
