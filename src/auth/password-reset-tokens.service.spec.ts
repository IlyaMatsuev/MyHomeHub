import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PasswordResetTokensService } from './password-reset-tokens.service';
import { AuthConfigService } from './auth-config.service';
import { PASSWORD_RESET_REDIS_CLIENT, PASSWORD_RESET_TOKEN_REDIS_KEY_PREFIX } from 'auth/auth.constants';

describe('PasswordResetTokensService', () => {
    let service: PasswordResetTokensService;
    let mockRedis: { set: jest.Mock; getdel: jest.Mock };
    let mockAuthConfig: { getPasswordResetTokenTtlSec: jest.Mock };

    const buildKey = (rawToken: string): string =>
        `${PASSWORD_RESET_TOKEN_REDIS_KEY_PREFIX}:${createHash('sha256').update(rawToken).digest('hex')}`;

    beforeEach(async () => {
        mockRedis = {
            set: jest.fn().mockResolvedValue('OK'),
            getdel: jest.fn(),
        };
        mockAuthConfig = {
            getPasswordResetTokenTtlSec: jest.fn().mockReturnValue(300),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PasswordResetTokensService,
                { provide: PASSWORD_RESET_REDIS_CLIENT, useValue: mockRedis },
                { provide: AuthConfigService, useValue: mockAuthConfig },
            ],
        }).compile();

        service = module.get<PasswordResetTokensService>(PasswordResetTokensService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('issue', () => {
        it('should generate a random token and store its hash in Redis with the configured TTL', async () => {
            const rawToken = await service.issue('user-external-id');

            expect(typeof rawToken).toBe('string');
            expect(rawToken.length).toBeGreaterThan(0);
            expect(mockRedis.set).toHaveBeenCalledTimes(1);
            expect(mockRedis.set).toHaveBeenCalledWith(buildKey(rawToken), 'user-external-id', 'EX', 300);
        });

        it('should never expose the raw token as the Redis key', async () => {
            const rawToken = await service.issue('user-external-id');
            const usedKey = mockRedis.set.mock.calls[0][0];

            expect(usedKey).not.toContain(rawToken);
            expect(usedKey.startsWith(`${PASSWORD_RESET_TOKEN_REDIS_KEY_PREFIX}:`)).toBe(true);
        });

        it('should produce unique tokens across issues', async () => {
            const first = await service.issue('user-external-id');
            const second = await service.issue('user-external-id');

            expect(first).not.toBe(second);
        });
    });

    describe('consume', () => {
        it('should return the associated user id when the token exists', async () => {
            mockRedis.getdel.mockResolvedValue('user-external-id');

            const result = await service.consume('valid-token');

            expect(result).toBe('user-external-id');
            expect(mockRedis.getdel).toHaveBeenCalledWith(buildKey('valid-token'));
        });

        it('should throw UnauthorizedException when the token does not exist', async () => {
            mockRedis.getdel.mockResolvedValue(null);

            await expect(service.consume('unknown-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException on a second consume call for the same token', async () => {
            mockRedis.getdel.mockResolvedValueOnce('user-external-id').mockResolvedValueOnce(null);

            await expect(service.consume('one-shot-token')).resolves.toBe('user-external-id');
            await expect(service.consume('one-shot-token')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('issue + consume round trip', () => {
        it('should consume a freshly issued token', async () => {
            let stored: string | null = null;
            mockRedis.set.mockImplementation(async (_key, value) => {
                stored = value;
                return 'OK';
            });
            mockRedis.getdel.mockImplementation(async () => {
                const value = stored;
                stored = null;
                return value;
            });

            const rawToken = await service.issue('user-external-id');
            const userId = await service.consume(rawToken);

            expect(userId).toBe('user-external-id');
            await expect(service.consume(rawToken)).rejects.toThrow(UnauthorizedException);
        });
    });
});
