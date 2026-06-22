import { RegistrationRequestResponseDto } from './registration-request-response.dto';
import { RegistrationRequest, RegistrationRequestStatus, UserRole } from 'users/interfaces';

describe('RegistrationRequestResponseDto', () => {
    const buildRequest = (overrides: Partial<RegistrationRequest> = {}): RegistrationRequest =>
        ({
            externalId: 'uuid-1',
            requesterEmail: 'user@example.com',
            requesterComment: 'Please approve',
            status: RegistrationRequestStatus.Pending,
            role: UserRole.Guest,
            blackListed: false,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            ...overrides,
        }) as RegistrationRequest;

    it('should copy scalar fields from the source request', () => {
        const request = buildRequest();

        const dto = new RegistrationRequestResponseDto(request);

        expect(dto.externalId).toBe(request.externalId);
        expect(dto.requesterEmail).toBe(request.requesterEmail);
        expect(dto.requesterComment).toBe(request.requesterComment);
        expect(dto.status).toBe(request.status);
        expect(dto.role).toBe(request.role);
        expect(dto.blackListed).toBe(request.blackListed);
    });

    it('should convert createdAt and updatedAt Date fields to numeric timestamps', () => {
        const request = buildRequest();

        const dto = new RegistrationRequestResponseDto(request);

        expect(dto.createdAt).toBe(request.createdAt.getTime());
        expect(dto.updatedAt).toBe(request.updatedAt.getTime());
        expect(typeof dto.createdAt).toBe('number');
        expect(typeof dto.updatedAt).toBe('number');
    });

    it('should leave timestamps as undefined when source dates are missing', () => {
        const request = buildRequest({ createdAt: undefined, updatedAt: undefined });

        const dto = new RegistrationRequestResponseDto(request);

        expect(dto.createdAt).toBeUndefined();
        expect(dto.updatedAt).toBeUndefined();
    });
});
