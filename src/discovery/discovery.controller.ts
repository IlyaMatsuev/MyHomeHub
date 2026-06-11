import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiInternalError } from 'common/decorators';
import { Public } from 'auth/decorators';
import { ServerInfoDto } from './dto';
import { DiscoveryService } from './discovery.service';

@Controller('info')
@ApiTags('Discovery')
@ApiInternalError()
export class DiscoveryController {
    constructor(private readonly discoveryService: DiscoveryService) {}

    @Public()
    @Get()
    @ApiOperation({ summary: 'Get server information for discovery' })
    @ApiOkResponse({ type: ServerInfoDto, description: 'Server information including label, address, and port' })
    getServerInfo(): ServerInfoDto {
        return this.discoveryService.getServerInfo();
    }
}
