import { request } from 'gaxios';
import { HttpTransportService } from './http-transport.service';
import { HttpMessage, TransportProtocol } from 'devices-control/interfaces';
import { DEVICE_STATE_READ_TIMEOUT_MS } from 'devices-control/devices-control.constants';

jest.mock('gaxios', () => ({
    request: jest.fn(),
}));

describe('HttpTransportService', () => {
    let service: HttpTransportService;
    const mockRequest = request as unknown as jest.Mock;

    beforeEach(() => {
        service = new HttpTransportService();
        mockRequest.mockResolvedValue({ data: {} });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should expose the http protocol', () => {
        expect(service.protocol).toBe(TransportProtocol.Http);
    });

    describe('send', () => {
        it('should issue a request mapping url, method and payload', async () => {
            const message: HttpMessage = {
                method: 'POST',
                url: 'http://192.168.1.10/rpc',
                payload: { id: 1, method: 'Switch.Set' },
            };

            await service.send(message);

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'http://192.168.1.10/rpc',
                method: 'POST',
                data: { id: 1, method: 'Switch.Set' },
            });
        });

        it('should propagate request errors', async () => {
            mockRequest.mockRejectedValue(new Error('network down'));

            await expect(service.send({ method: 'GET', url: 'http://device' })).rejects.toThrow('network down');
        });
    });

    describe('receive', () => {
        it('should return the response data of the request', async () => {
            mockRequest.mockResolvedValue({ data: { id: 1, result: { output: true } } });
            const message: HttpMessage = {
                method: 'POST',
                url: 'http://192.168.1.10/rpc',
                payload: { id: 1, method: 'Switch.GetStatus' },
            };

            const result = await service.receive(message);

            expect(result).toEqual({ id: 1, result: { output: true } });
            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'http://192.168.1.10/rpc',
                    method: 'POST',
                    data: { id: 1, method: 'Switch.GetStatus' },
                }),
            );
        });

        it('should time out the request, so an offline device does not block the caller', async () => {
            await service.receive({ method: 'GET', url: 'http://device' });

            expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ timeout: DEVICE_STATE_READ_TIMEOUT_MS }));
        });

        it('should propagate request errors', async () => {
            mockRequest.mockRejectedValue(new Error('network down'));

            await expect(service.receive({ method: 'GET', url: 'http://device' })).rejects.toThrow('network down');
        });
    });
});
