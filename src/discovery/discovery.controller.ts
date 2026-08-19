import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiForbidden, ApiInternalError } from 'common/decorators';
import { LocalNetworkOnly, Public } from 'auth/decorators';
import { ServerDto } from 'discovery/dto';
import { DiscoveryService } from 'discovery/discovery.service';

@Controller('info')
@ApiTags('Discovery')
@ApiInternalError()
export class DiscoveryController {
    constructor(private readonly discoveryService: DiscoveryService) {}

    @Public()
    @LocalNetworkOnly()
    @Get()
    @ApiOperation({
        summary: 'Get server information for discovery',
        description: 'Only accessible from the local network when LOCAL_NETWORK_ONLY_ENABLED is on',
    })
    @ApiOkResponse({ type: ServerDto, description: 'Server information including label, address, and port' })
    @ApiForbidden()
    getServerInfo(): ServerDto {
        return this.discoveryService.getServerInfo();
    }
}
