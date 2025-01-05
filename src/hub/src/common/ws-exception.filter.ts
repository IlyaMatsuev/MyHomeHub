import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
    catch(exception: WsException, host: ArgumentsHost) {
        const ctx = host.switchToWs();
        const client = ctx.getClient<WebSocket>();
        client.send(JSON.stringify({
            error: exception.message,
            data: { success: false }
        }));
    }
}
