import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from 'users/interfaces';

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;

    beforeEach(() => {
        const configService = { get: jest.fn().mockReturnValue('test-jwt-secret') } as unknown as ConfigService;
        strategy = new JwtStrategy(configService);
    });

    describe('validate', () => {
        it('should map the JWT payload to an authenticated user', () => {
            const result = strategy.validate({ sub: 'user-id-123', email: 'test@example.com', role: UserRole.Resident });

            expect(result).toEqual({ userId: 'user-id-123', email: 'test@example.com', role: UserRole.Resident });
        });
    });
});
