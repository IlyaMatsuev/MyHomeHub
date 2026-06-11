import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'Discovery.ServerInfo', description: 'Server information for discovery' })
export class ServerInfoDto {
    @ApiProperty({ description: 'Human-readable label of the server', example: 'My Smart Home' })
    label: string;

    @ApiProperty({ description: 'Local IP address of the server', example: '192.168.1.100' })
    address: string;

    @ApiProperty({ description: 'Port the server is listening on', example: 3000 })
    port: number;
}
