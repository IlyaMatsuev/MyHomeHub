import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookiesConfigService } from 'auth/cookies-config.service';

describe('AuthController', () => {
    let controller: AuthController;
    let mockAuthService: {
        login: jest.Mock;
        refreshToken: jest.Mock;
        register: jest.Mock;
    };

    beforeEach(async () => {
        mockAuthService = {
            login: jest.fn(),
            refreshToken: jest.fn(),
            register: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
                {
                    provide: CookiesConfigService,
                    useValue: { get: jest.fn(() => ({})) },
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should call authService.login with credentials and return tokens', async () => {
            const loginDto = { email: 'test@example.com', password: 'password123' };
            const tokens = { externalId: 'user-external-id', accessToken: 'jwt-token', refreshToken: 'refresh-token' };
            mockAuthService.login.mockResolvedValue(tokens);

            const result = await controller.login(loginDto);

            expect(result).toEqual(tokens);
            expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
        });
    });

    describe('loginWithToken', () => {
        it('should call authService.refreshToken with the refresh token and return tokens', async () => {
            const refreshDto = { refreshToken: 'old-refresh-token' };
            const tokens = { externalId: 'user-external-id', accessToken: 'jwt-token', refreshToken: 'new-refresh-token' };
            mockAuthService.refreshToken.mockResolvedValue(tokens);

            const result = await controller.loginWithToken(refreshDto);

            expect(result).toEqual(tokens);
            expect(mockAuthService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
        });
    });

    describe('register', () => {
        it('should register new user and return the externalId and email', async () => {
            const registerDto = { email: 'new@example.com', password: 'password123', totp: '123456' };
            const registerResponse = { externalId: 'new-user-external-id', email: 'new@example.com' };
            mockAuthService.register.mockResolvedValue(registerResponse);

            const result = await controller.register(registerDto);

            expect(result).toEqual(registerResponse);
            expect(mockAuthService.register).toHaveBeenCalledWith('new@example.com', 'password123', '123456');
        });
    });
});
