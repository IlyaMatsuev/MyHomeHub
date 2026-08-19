import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_LOCAL_NETWORK_ONLY_KEY } from 'auth/decorators';
import { LocalNetworkService } from 'common/services';
import { LocalNetworkGuard } from './local-network.guard';

describe('LocalNetworkGuard', () => {
    let guard: LocalNetworkGuard;
    let mockReflector: { getAllAndOverride: jest.Mock };
    let mockLocalNetworkService: { isRestrictionEnabled: jest.Mock; isLocalRequest: jest.Mock };
    let debugSpy: jest.SpyInstance;

    const handler = () => undefined;
    const controllerClass = class {};

    const createMockContext = (type = 'http'): ExecutionContext =>
        ({
            getType: jest.fn().mockReturnValue(type),
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({ ip: '8.8.8.8', originalUrl: '/auth/register/requests' }),
            }),
            getHandler: jest.fn().mockReturnValue(handler),
            getClass: jest.fn().mockReturnValue(controllerClass),
        }) as unknown as ExecutionContext;

    beforeEach(() => {
        debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
        mockReflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
        mockLocalNetworkService = {
            isRestrictionEnabled: jest.fn().mockReturnValue(true),
            isLocalRequest: jest.fn().mockReturnValue(false),
        };
        guard = new LocalNetworkGuard(mockReflector as unknown as Reflector, mockLocalNetworkService as unknown as LocalNetworkService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        debugSpy.mockRestore();
    });

    it('should allow non-http contexts (e.g. MQTT) without checking the client address', () => {
        expect(guard.canActivate(createMockContext('rpc'))).toBe(true);
        expect(mockReflector.getAllAndOverride).not.toHaveBeenCalled();
        expect(mockLocalNetworkService.isLocalRequest).not.toHaveBeenCalled();
    });

    it('should allow endpoints that are not marked as local network only', () => {
        mockReflector.getAllAndOverride.mockReturnValue(undefined);

        expect(guard.canActivate(createMockContext())).toBe(true);
        expect(mockLocalNetworkService.isLocalRequest).not.toHaveBeenCalled();
    });

    it('should allow remote requests when the restriction is disabled', () => {
        mockLocalNetworkService.isRestrictionEnabled.mockReturnValue(false);

        expect(guard.canActivate(createMockContext())).toBe(true);
        expect(mockLocalNetworkService.isLocalRequest).not.toHaveBeenCalled();
    });

    it('should allow requests coming from the local network', () => {
        mockLocalNetworkService.isLocalRequest.mockReturnValue(true);

        expect(guard.canActivate(createMockContext())).toBe(true);
        expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_LOCAL_NETWORK_ONLY_KEY, [handler, controllerClass]);
    });

    it('should reject requests coming from outside of the local network', () => {
        expect(() => guard.canActivate(createMockContext())).toThrow(ForbiddenException);
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('8.8.8.8'));
    });
});
