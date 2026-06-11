import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { DEFAULT_PORT, DEFAULT_SERVER_LABEL } from 'common/common.constants';

@ApiSchema({ name: 'Discovery.Server', description: 'Server information for discovery' })
export class ServerDto {
    @ApiProperty({ description: 'Human-readable label of the server', example: DEFAULT_SERVER_LABEL })
    label: string;

    @ApiProperty({ description: 'Local IP address of the server', example: '192.168.1.100' })
    address: string;

    @ApiProperty({ description: 'Port the server is listening on', example: DEFAULT_PORT })
    port: number;
}
