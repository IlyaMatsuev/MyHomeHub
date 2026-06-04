import { PaginationResponseDto } from './pagination-response.dto';

describe('PaginationResponseDto', () => {
    describe('when totalItems is provided', () => {
        it('should keep the provided items untouched and trust the totalItems count', () => {
            const items = [{ id: 1 }, { id: 2 }];

            const result = new PaginationResponseDto(items, 2, 2, 12);

            expect(result.items).toBe(items);
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(2);
            expect(result.totalItems).toBe(12);
            expect(result.totalPages).toBe(6);
        });

        it('should round totalPages up when totalItems does not divide evenly by pageSize', () => {
            const result = new PaginationResponseDto([], 1, 10, 25);

            expect(result.totalPages).toBe(3);
        });

        it('should fall back to a single page when pageSize is 0', () => {
            const result = new PaginationResponseDto([], 1, 0, 0);

            expect(result.totalPages).toBe(1);
            expect(result.totalItems).toBe(0);
        });
    });

    describe('when totalItems is omitted', () => {
        it('should slice the provided items to the requested page window', () => {
            const items = Array.from({ length: 7 }, (_, i) => ({ id: i + 1 }));

            const result = new PaginationResponseDto(items, 2, 3);

            expect(result.items).toEqual([{ id: 4 }, { id: 5 }, { id: 6 }]);
            expect(result.totalItems).toBe(7);
            expect(result.totalPages).toBe(3);
        });

        it('should return an empty slice when the requested page is past the end of the data', () => {
            const items = [{ id: 1 }, { id: 2 }];

            const result = new PaginationResponseDto(items, 5, 2);

            expect(result.items).toEqual([]);
            expect(result.totalItems).toBe(2);
        });
    });
});
