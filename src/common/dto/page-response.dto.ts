import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'PageResponse', description: 'Generic paginated response' })
export class PageResponseDto<T> {
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

    private constructor(items: Array<T>, page: number, pageSize: number, totalItems: number) {
        this.items = items;
        this.page = page;
        this.pageSize = pageSize;
        this.totalItems = totalItems;
        this.totalPages = Math.ceil(totalItems / pageSize);
    }

    static fromQuery<T>(items: Array<T>, page: number, pageSize: number, totalItems: number): PageResponseDto<T> {
        return new PageResponseDto(items, page, pageSize, totalItems);
    }

    static fromArray<T>(items: Array<T>, page: number, pageSize: number): PageResponseDto<T> {
        const totalItems = items.length;
        const skipRecords = (page - 1) * pageSize;
        const slicedItems = items.slice(skipRecords, skipRecords + pageSize);
        return new PageResponseDto(slicedItems, page, pageSize, totalItems);
    }
}
