import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationRequestsController } from './registration-requests.controller';
import { RegistrationRequestsService } from 'users/registration-requests.service';
import { RegistrationRequest, RegistrationRequestStatus, UserRole } from 'users/interfaces';
import { PaginationResponseDto } from 'common/dto';
import { RegistrationRequestResponseDto } from 'users/dto';

describe('RegistrationRequestsController', () => {
    let controller: RegistrationRequestsController;
    let mockRegistrationRequestsService: {
        getRequests: jest.Mock;
        getRequestByExternalId: jest.Mock;
        createRequest: jest.Mock;
        updateRequest: jest.Mock;
    };

    const mockRequest = {
        externalId: 'test-uuid',
        requesterEmail: 'test@example.com',
        status: RegistrationRequestStatus.Pending,
        role: UserRole.Guest,
        requesterComment: 'Test comment',
        blackListed: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    } as unknown as RegistrationRequest;

    const mockRequestResponse: RegistrationRequestResponseDto = {
        externalId: 'test-uuid',
        requesterEmail: 'test@example.com',
        status: RegistrationRequestStatus.Pending,
        role: UserRole.Guest,
        requesterComment: 'Test comment',
        blackListed: false,
        createdAt: new Date('2026-01-01').getTime(),
        updatedAt: new Date('2026-01-01').getTime(),
    };

    beforeEach(async () => {
        mockRegistrationRequestsService = {
            getRequests: jest.fn(),
            getRequestByExternalId: jest.fn(),
            createRequest: jest.fn(),
            updateRequest: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [RegistrationRequestsController],
            providers: [
                {
                    provide: RegistrationRequestsService,
                    useValue: mockRegistrationRequestsService,
                },
            ],
        }).compile();

        controller = module.get<RegistrationRequestsController>(RegistrationRequestsController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createRequest', () => {
        it('should create a new registration request', async () => {
            mockRegistrationRequestsService.createRequest.mockResolvedValue(mockRequestResponse);

            const result = await controller.createRequest({ email: 'test@example.com', comment: 'Test comment' });

            expect(result).toEqual(mockRequestResponse);
            expect(mockRegistrationRequestsService.createRequest).toHaveBeenCalledWith({
                email: 'test@example.com',
                comment: 'Test comment',
            });
        });
    });

    describe('getRequest', () => {
        it('should return a registration request by external ID with timestamp fields', async () => {
            mockRegistrationRequestsService.getRequestByExternalId.mockResolvedValue(mockRequest);

            const result = await controller.getRequest('test-uuid');

            expect(result).toEqual(mockRequestResponse);
            expect(mockRegistrationRequestsService.getRequestByExternalId).toHaveBeenCalledWith('test-uuid', { strict: true });
        });
    });

    describe('updateRequest', () => {
        it('should approve a registration request', async () => {
            const approvedResponse = { ...mockRequestResponse, status: RegistrationRequestStatus.Approved };
            mockRegistrationRequestsService.updateRequest.mockResolvedValue(approvedResponse);

            const result = await controller.updateRequest('test-uuid', { approve: true });

            expect(result.status).toBe(RegistrationRequestStatus.Approved);
            expect(mockRegistrationRequestsService.updateRequest).toHaveBeenCalledWith('test-uuid', { approve: true });
        });

        it('should reject a registration request', async () => {
            const rejectedResponse = { ...mockRequestResponse, status: RegistrationRequestStatus.Rejected };
            mockRegistrationRequestsService.updateRequest.mockResolvedValue(rejectedResponse);

            const result = await controller.updateRequest('test-uuid', { approve: false });

            expect(result.status).toBe(RegistrationRequestStatus.Rejected);
            expect(mockRegistrationRequestsService.updateRequest).toHaveBeenCalledWith('test-uuid', { approve: false });
        });

        it('should approve a registration request with a chosen role', async () => {
            const approvedResponse = { ...mockRequestResponse, status: RegistrationRequestStatus.Approved, role: UserRole.Resident };
            mockRegistrationRequestsService.updateRequest.mockResolvedValue(approvedResponse);

            const result = await controller.updateRequest('test-uuid', { approve: true, role: UserRole.Resident });

            expect(result.role).toBe(UserRole.Resident);
            expect(mockRegistrationRequestsService.updateRequest).toHaveBeenCalledWith('test-uuid', {
                approve: true,
                role: UserRole.Resident,
            });
        });

        it('should reject and blacklist a registration request', async () => {
            const rejectedResponse = { ...mockRequestResponse, status: RegistrationRequestStatus.Rejected };
            mockRegistrationRequestsService.updateRequest.mockResolvedValue(rejectedResponse);

            const result = await controller.updateRequest('test-uuid', { approve: false, blackListed: true });

            expect(result.status).toBe(RegistrationRequestStatus.Rejected);
            expect(mockRegistrationRequestsService.updateRequest).toHaveBeenCalledWith('test-uuid', {
                approve: false,
                blackListed: true,
            });
        });
    });

    describe('getRequests', () => {
        it('should return paginated registration requests', async () => {
            const paginatedResponse = new PaginationResponseDto([mockRequestResponse], 1, 10, 1);
            mockRegistrationRequestsService.getRequests.mockResolvedValue(paginatedResponse);

            const result = await controller.getRequests({ page: 1, pageSize: 10, skipRecords: 0 });

            expect(result.items).toHaveLength(1);
            expect(result.totalItems).toBe(1);
            expect(mockRegistrationRequestsService.getRequests).toHaveBeenCalledWith({ page: 1, pageSize: 10, skipRecords: 0 });
        });

        it('should filter by status when provided', async () => {
            const paginatedResponse = new PaginationResponseDto([mockRequestResponse], 1, 10, 1);
            mockRegistrationRequestsService.getRequests.mockResolvedValue(paginatedResponse);

            await controller.getRequests({ page: 1, pageSize: 10, skipRecords: 0, status: RegistrationRequestStatus.Pending });

            expect(mockRegistrationRequestsService.getRequests).toHaveBeenCalledWith({
                page: 1,
                pageSize: 10,
                skipRecords: 0,
                status: RegistrationRequestStatus.Pending,
            });
        });
    });
});
