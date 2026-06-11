import { Module } from '@nestjs/common';
import { DiscoveryController } from 'discovery/discovery.controller';
import { DiscoveryService } from 'discovery/discovery.service';

@Module({
    controllers: [DiscoveryController],
    providers: [DiscoveryService],
})
export class DiscoveryModule {}
