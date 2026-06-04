import { IsInt, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE, MIN_PAGE_SIZE, DEFAULT_PAGE_SIZE, MIN_PAGE } from 'common/common.constants';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Common.Pagination', description: 'DTO used to fetch a specific page of the existing records' })
export class PaginationDto {
    @IsInt()
    @Min(MIN_PAGE)
    @ApiProperty({ required: false, description: 'The page number', default: MIN_PAGE, minimum: MIN_PAGE })
    page: number = MIN_PAGE;

    @IsInt()
    @Min(MIN_PAGE_SIZE)
    @Max(MAX_PAGE_SIZE)
    @ApiProperty({
        required: false,
        description: 'The amount of records displayed per page',
        default: DEFAULT_PAGE_SIZE,
        minimum: MIN_PAGE,
    })
    pageSize: number = DEFAULT_PAGE_SIZE;

    get skipRecords() {
        return (this.page - 1) * this.pageSize;
    }
}
