import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';

describe('AuthController', () => {
    let controller: AuthController;
    let mockAuthService: {
        login: jest.Mock;
        register: jest.Mock;
    };
    let mockResponse: Partial<Response>;

    beforeEach(async () => {
        mockAuthService = {
            login: jest.fn(),
            register: jest.fn(),
        };
        mockResponse = {
            cookie: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should return access token and set cookie', async () => {
            const loginDto = { email: 'test@example.com', password: 'password123' };
            mockAuthService.login.mockResolvedValue({ accessToken: 'jwt-token' });

            const result = await controller.login(loginDto, mockResponse as Response);

            expect(result).toEqual({ accessToken: 'jwt-token' });
            expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
            expect(mockResponse.cookie).toHaveBeenCalledWith('accessToken', 'jwt-token', { httpOnly: true });
        });
    });

    describe('register', () => {
        it('should register new user and return only the email', async () => {
            const registerDto = { email: 'new@example.com', password: 'password123', totp: '123456' };
            const registerResponse = { email: 'new@example.com' };
            mockAuthService.register.mockResolvedValue(registerResponse);

            const result = await controller.register(registerDto);

            expect(result).toEqual(registerResponse);
            expect(mockAuthService.register).toHaveBeenCalledWith('new@example.com', 'password123', '123456');
        });
    });
});
