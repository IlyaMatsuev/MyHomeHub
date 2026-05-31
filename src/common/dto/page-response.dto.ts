import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

@ApiSchema({ name: 'PaginationResponse', description: 'Generic paginated response' })
export class PaginationResponse<T> {
    @ApiProperty({ description: 'Array of items for the current page', isArray: true })
    items: Array<T>;

    @ApiProperty({ description: 'Current page number', example: 1 })
    page: number;

    @ApiProperty({ description: 'Number of items per page', example: 5 })
    pageSize: number;

    @ApiProperty({ description: 'Total number of pages', example: 10 })
    totalPages: number;

    @ApiProperty({ description: 'Total number of items across all pages', example: 50 })
    totalItems: number;

    constructor(items: Array<T>, page: number, pageSize: number, totalItems?: number) {
        if (totalItems === undefined) {
            this.totalItems = items.length;
            const skipRecords = (page - 1) * pageSize;
            this.items = items.slice(skipRecords, skipRecords + pageSize);
        } else {
            this.totalItems = totalItems;
            this.items = items;
        }
        this.page = page;
        this.pageSize = pageSize;
        this.totalPages = Math.ceil(this.totalItems / pageSize);
    }
}

export const ApiPaginationResponse = <TModel extends Type<unknown>>(model: TModel, description?: string) => {
    return applyDecorators(
        ApiExtraModels(PaginationResponse, model),
        ApiOkResponse({
            description: description ?? `Paginated list of ${model.name}`,
            schema: {
                allOf: [
                    { $ref: getSchemaPath(PaginationResponse) },
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
