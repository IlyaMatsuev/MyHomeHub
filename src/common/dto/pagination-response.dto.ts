import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE, MIN_PAGE_SIZE } from 'common/common.constants';

@ApiSchema({ name: 'Common.PaginationResponse', description: 'Generic paginated response' })
export class PaginationResponseDto<T> {
    @ApiProperty({ description: 'Array of items for the current page', isArray: true })
    items: Array<T>;

    @ApiProperty({ description: 'Current page number', minimum: MIN_PAGE, example: MIN_PAGE })
    page: number;

    @ApiProperty({ description: 'Number of items per page', minimum: MIN_PAGE_SIZE, maximum: MAX_PAGE_SIZE, example: DEFAULT_PAGE_SIZE })
    pageSize: number;

    @ApiProperty({ description: 'Total number of pages', example: 10 })
    totalPages: number;

    @ApiProperty({ description: 'Total number of items across all pages', example: 50 })
    totalItems: number;

    constructor(items: Array<T>, page: number, pageSize: number, totalItems?: number) {
        if (totalItems == null) {
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
