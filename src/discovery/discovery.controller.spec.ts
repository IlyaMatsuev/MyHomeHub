import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { ServerInfoDto } from './dto';

describe('DiscoveryController', () => {
    let controller: DiscoveryController;
    let mockDiscoveryService: {
        getServerInfo: jest.Mock;
    };

    beforeEach(async () => {
        mockDiscoveryService = {
            getServerInfo: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DiscoveryController],
            providers: [
                {
                    provide: DiscoveryService,
                    useValue: mockDiscoveryService,
                },
            ],
        }).compile();

        controller = module.get<DiscoveryController>(DiscoveryController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getServerInfo', () => {
        it('should return server info from discovery service', () => {
            const expectedInfo: ServerInfoDto = {
                label: 'Test Smart Home',
                address: '192.168.1.100',
                port: 3000,
            };
            mockDiscoveryService.getServerInfo.mockReturnValue(expectedInfo);

            const result = controller.getServerInfo();

            expect(result).toEqual(expectedInfo);
            expect(mockDiscoveryService.getServerInfo).toHaveBeenCalledTimes(1);
        });

        it('should return default values when not configured', () => {
            const expectedInfo: ServerInfoDto = {
                label: 'SmartHome Hub',
                address: '127.0.0.1',
                port: 3000,
            };
            mockDiscoveryService.getServerInfo.mockReturnValue(expectedInfo);

            const result = controller.getServerInfo();

            expect(result).toEqual(expectedInfo);
        });
    });
});
