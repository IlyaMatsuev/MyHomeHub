import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegistrationRequestsService } from './registration-requests.service';
import { RegistrationRequestStatus, RegistrationRequest } from 'users/interfaces';
import { REGISTRATION_REQUEST_MODEL_PROVIDER_NAME, REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT } from 'users/users.constants';

describe('RegistrationRequestsService', () => {
    let service: RegistrationRequestsService;
    let mockRegistrationRequestModel: {
        find: jest.Mock;
        findOne: jest.Mock;
        countDocuments: jest.Mock;
    } & jest.Mock;
    let mockSaveFn: jest.Mock;

    const createMockRequest = (overrides = {}): Partial<RegistrationRequest> => ({
        externalId: 'test-uuid',
        requesterEmail: 'test@example.com',
        status: RegistrationRequestStatus.Pending,
        requesterComment: 'Test comment',
        blackListed: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        save: mockSaveFn,
        ...overrides,
    });

    beforeEach(async () => {
        mockSaveFn = jest.fn();

        const MockModel = function (data: Record<string, unknown>) {
            return {
                ...data,
                save: mockSaveFn,
            };
        } as unknown as typeof mockRegistrationRequestModel;
        MockModel.find = jest.fn().mockReturnThis();
        MockModel.findOne = jest.fn().mockReturnThis();
        MockModel.countDocuments = jest.fn().mockReturnThis();

        mockRegistrationRequestModel = MockModel;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RegistrationRequestsService,
                {
                    provide: REGISTRATION_REQUEST_MODEL_PROVIDER_NAME,
                    useValue: mockRegistrationRequestModel,
                },
            ],
        }).compile();

        service = module.get<RegistrationRequestsService>(RegistrationRequestsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getRequests', () => {
        it('should return paginated requests', async () => {
            const mockRequests = [createMockRequest(), createMockRequest({ requesterEmail: 'test2@example.com' })];
            mockRegistrationRequestModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(mockRequests),
                        }),
                    }),
                }),
            });
            mockRegistrationRequestModel.countDocuments.mockReturnValue({
                exec: jest.fn().mockResolvedValue(2),
            });

            const result = await service.getRequests({ page: 1, pageSize: 10, skipRecords: 0 });

            expect(result.items).toHaveLength(2);
            expect(result.totalItems).toBe(2);
        });

        it('should filter by status when provided', async () => {
            const mockRequests = [createMockRequest()];
            mockRegistrationRequestModel.find.mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(mockRequests),
                        }),
                    }),
                }),
            });
            mockRegistrationRequestModel.countDocuments.mockReturnValue({
                exec: jest.fn().mockResolvedValue(1),
            });

            await service.getRequests({ page: 1, pageSize: 10, skipRecords: 0, status: RegistrationRequestStatus.Pending });

            expect(mockRegistrationRequestModel.find).toHaveBeenCalledWith({ status: RegistrationRequestStatus.Pending });
        });
    });

    describe('getRequest', () => {
        it('should return request when found', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });

            const result = await service.getRequest('test-uuid');

            expect(result.externalId).toBe('test-uuid');
            expect(result.requesterEmail).toBe('test@example.com');
        });

        it('should throw NotFoundException when request not found', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getRequest('non-existent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('createRequest', () => {
        it('should create a new request when email is not registered', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            const savedRequest = createMockRequest();
            mockSaveFn.mockResolvedValue(savedRequest);

            const result = await service.createRequest({ email: 'new@example.com', comment: 'Please approve' });

            expect(result.requesterEmail).toBe('test@example.com');
            expect(mockSaveFn).toHaveBeenCalled();
        });

        it('should throw BadRequestException when pending request exists', async () => {
            const pendingRequest = createMockRequest({ status: RegistrationRequestStatus.Pending });
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(pendingRequest),
            });

            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(BadRequestException);
            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(
                'A pending registration request for this email already exists',
            );
        });

        it('should throw BadRequestException when approved request exists', async () => {
            const approvedRequest = createMockRequest({ status: RegistrationRequestStatus.Approved });
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(approvedRequest),
            });

            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(BadRequestException);
            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(
                'A registration request for this email has already been approved',
            );
        });

        it('should update rejected request to pending when not blacklisted', async () => {
            const rejectedRequest = createMockRequest({
                status: RegistrationRequestStatus.Rejected,
                blackListed: false,
            });
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(rejectedRequest),
            });
            const updatedRequest = { ...rejectedRequest, status: RegistrationRequestStatus.Pending };
            mockSaveFn.mockResolvedValue(updatedRequest);

            const result = await service.createRequest({ email: 'test@example.com', comment: 'Retry please' });

            expect(result.status).toBe(RegistrationRequestStatus.Pending);
        });

        it('should throw ForbiddenException when rejected and blacklisted', async () => {
            const blacklistedRequest = createMockRequest({
                status: RegistrationRequestStatus.Rejected,
                blackListed: true,
            });
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(blacklistedRequest),
            });

            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(ForbiddenException);
            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(
                'Registration requests from this email are not allowed',
            );
        });
    });

    describe('updateRequest', () => {
        it('should approve request', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });
            const approvedRequest = { ...mockRequest, status: RegistrationRequestStatus.Approved };
            mockSaveFn.mockResolvedValue(approvedRequest);

            const result = await service.updateRequest('test-uuid', { approve: true });

            expect(result.status).toBe(RegistrationRequestStatus.Approved);
        });

        it('should reject request', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });
            const rejectedRequest = { ...mockRequest, status: RegistrationRequestStatus.Rejected };
            mockSaveFn.mockResolvedValue(rejectedRequest);

            const result = await service.updateRequest('test-uuid', { approve: false });

            expect(result.status).toBe(RegistrationRequestStatus.Rejected);
        });

        it('should reject and blacklist request', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });
            const rejectedRequest = { ...mockRequest, status: RegistrationRequestStatus.Rejected, blackListed: true };
            mockSaveFn.mockResolvedValue(rejectedRequest);

            const result = await service.updateRequest('test-uuid', { approve: false, blackListed: true });

            expect(result.status).toBe(RegistrationRequestStatus.Rejected);
        });

        it('should throw BadRequestException when trying to approve and blacklist', async () => {
            await expect(service.updateRequest('test-uuid', { approve: true, blackListed: true })).rejects.toThrow(BadRequestException);
            await expect(service.updateRequest('test-uuid', { approve: true, blackListed: true })).rejects.toThrow(
                'Cannot approve and blacklist at the same time',
            );
        });

        it('should throw NotFoundException when request not found', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.updateRequest('non-existent', { approve: true })).rejects.toThrow(NotFoundException);
        });
    });

    describe('createAutoApprovedRequest', () => {
        it('should create auto-approved request for new email', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            const savedRequest = createMockRequest({
                status: RegistrationRequestStatus.Approved,
                requesterComment: REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT,
            });
            mockSaveFn.mockResolvedValue(savedRequest);

            const result = await service.createAutoApprovedRequest('new@example.com');

            expect(result.status).toBe(RegistrationRequestStatus.Approved);
            expect(result.requesterComment).toBe(REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT);
        });

        it('should update existing request to approved', async () => {
            const existingRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existingRequest),
            });
            const updatedRequest = {
                ...existingRequest,
                status: RegistrationRequestStatus.Approved,
                requesterComment: REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT,
            };
            mockSaveFn.mockResolvedValue(updatedRequest);

            const result = await service.createAutoApprovedRequest('test@example.com');

            expect(result.status).toBe(RegistrationRequestStatus.Approved);
            expect(result.requesterComment).toBe(REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT);
        });
    });

    describe('findByEmail', () => {
        it('should return request when found', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });

            const result = await service.findByEmail('test@example.com');

            expect(result?.requesterEmail).toBe('test@example.com');
        });

        it('should return null when not found', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });
    });
});
