import { ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsExceptionFilter } from './ws-exception.filter';

describe('WsExceptionFilter', () => {
    let filter: WsExceptionFilter;
    let mockClient: {
        send: jest.Mock;
    };
    let mockHost: ArgumentsHost;

    beforeEach(() => {
        filter = new WsExceptionFilter();
        mockClient = {
            send: jest.fn(),
        };
        mockHost = {
            switchToWs: jest.fn().mockReturnValue({
                getClient: jest.fn().mockReturnValue(mockClient),
            }),
        } as unknown as ArgumentsHost;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should send error message to WebSocket client', () => {
        const exception = new WsException('WebSocket error');

        filter.catch(exception, mockHost);

        expect(mockClient.send).toHaveBeenCalledWith(
            JSON.stringify({
                error: 'WebSocket error',
                data: { success: false },
            }),
        );
    });

    it('should handle exception with object message', () => {
        const exception = new WsException({ message: 'Complex error', code: 'ERR_001' });

        filter.catch(exception, mockHost);

        expect(mockClient.send).toHaveBeenCalled();
        const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
        expect(sentMessage.data).toEqual({ success: false });
    });
});
