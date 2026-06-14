import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FieldValidationException } from 'common/exceptions';
import { RegistrationRequestsService } from './registration-requests.service';
import { RegistrationRequestStatus, RegistrationRequest, UserRole } from 'users/interfaces';
import {
    REGISTRATION_REQUEST_DEFAULT_ROLE,
    REGISTRATION_REQUEST_MODEL_PROVIDER_NAME,
    REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT,
    TOTP_REGISTRATION_ROLE,
} from 'users/users.constants';

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
        role: UserRole.Guest,
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

    describe('getRequestByExternalId', () => {
        it('should return the request when found', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });

            const result = await service.getRequestByExternalId('test-uuid');

            expect(result?.externalId).toBe('test-uuid');
            expect(mockRegistrationRequestModel.findOne).toHaveBeenCalledWith({ externalId: 'test-uuid' });
        });

        it('should return null when not found and not strict', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.getRequestByExternalId('non-existent');

            expect(result).toBeNull();
        });

        it('should throw NotFoundException when not found and strict', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getRequestByExternalId('non-existent', { strict: true })).rejects.toThrow(NotFoundException);
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

        it('should default the role to guest for a new request', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            mockSaveFn.mockImplementation(function (this: Record<string, unknown>) {
                return Promise.resolve(createMockRequest({ role: this.role }));
            });

            const result = await service.createRequest({ email: 'new@example.com' });

            expect(result.role).toBe(REGISTRATION_REQUEST_DEFAULT_ROLE);
            expect(REGISTRATION_REQUEST_DEFAULT_ROLE).toBe(UserRole.Guest);
        });

        it('should throw FieldValidationException when pending request exists', async () => {
            const pendingRequest = createMockRequest({ status: RegistrationRequestStatus.Pending });
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(pendingRequest),
            });

            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(FieldValidationException);
            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toMatchObject({
                response: {
                    messages: ['A pending registration request for this email already exists'],
                    details: { errors: [{ message: 'A pending registration request for this email already exists', path: 'email' }] },
                },
            });
        });

        it('should throw FieldValidationException when approved request exists', async () => {
            const approvedRequest = createMockRequest({ status: RegistrationRequestStatus.Approved });
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(approvedRequest),
            });

            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toThrow(FieldValidationException);
            await expect(service.createRequest({ email: 'test@example.com' })).rejects.toMatchObject({
                response: {
                    messages: ['A registration request for this email has already been approved'],
                    details: { errors: [{ message: 'A registration request for this email has already been approved', path: 'email' }] },
                },
            });
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
            expect(result.blackListed).toBe(true);
        });

        it('should assign the requested role when approving', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });
            mockSaveFn.mockImplementation(function (this: Record<string, unknown>) {
                return Promise.resolve(createMockRequest({ status: this.status, role: this.role }));
            });

            const result = await service.updateRequest('test-uuid', { approve: true, role: UserRole.Resident });

            expect(result.status).toBe(RegistrationRequestStatus.Approved);
            expect(result.role).toBe(UserRole.Resident);
        });

        it('should throw FieldValidationException when trying to approve and blacklist', async () => {
            await expect(service.updateRequest('test-uuid', { approve: true, blackListed: true })).rejects.toThrow(
                FieldValidationException,
            );
            await expect(service.updateRequest('test-uuid', { approve: true, blackListed: true })).rejects.toMatchObject({
                response: {
                    messages: ['Cannot approve and blacklist at the same time'],
                    details: { errors: [{ message: 'Cannot approve and blacklist at the same time', path: 'blackListed' }] },
                },
            });
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

        it('should assign the admin role to the auto-approved request', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            mockSaveFn.mockImplementation(function (this: Record<string, unknown>) {
                return Promise.resolve(createMockRequest({ status: this.status, role: this.role }));
            });

            const result = await service.createAutoApprovedRequest('new@example.com');

            expect(result.role).toBe(TOTP_REGISTRATION_ROLE);
            expect(TOTP_REGISTRATION_ROLE).toBe(UserRole.Admin);
        });

        it('should update existing request to approved with admin role', async () => {
            const existingRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existingRequest),
            });
            mockSaveFn.mockImplementation(() =>
                Promise.resolve({
                    ...existingRequest,
                    status: RegistrationRequestStatus.Approved,
                    role: existingRequest.role,
                    requesterComment: REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT,
                }),
            );

            const result = await service.createAutoApprovedRequest('test@example.com');

            expect(result.status).toBe(RegistrationRequestStatus.Approved);
            expect(result.requesterComment).toBe(REGISTRATION_REQUEST_TOTP_AUTO_APPROVAL_COMMENT);
            expect(existingRequest.role).toBe(TOTP_REGISTRATION_ROLE);
        });
    });

    describe('getRequestByEmail', () => {
        it('should return the request when found and lowercase the email', async () => {
            const mockRequest = createMockRequest();
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockRequest),
            });

            const result = await service.getRequestByEmail('Test@Example.com');

            expect(result?.requesterEmail).toBe('test@example.com');
            expect(mockRegistrationRequestModel.findOne).toHaveBeenCalledWith({ requesterEmail: 'test@example.com' });
        });

        it('should return null when not found and not strict', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.getRequestByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });

        it('should throw NotFoundException when not found and strict', async () => {
            mockRegistrationRequestModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getRequestByEmail('nonexistent@example.com', { strict: true })).rejects.toThrow(NotFoundException);
        });
    });
});
