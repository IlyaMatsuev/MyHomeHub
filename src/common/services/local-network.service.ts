import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import ipaddr from 'ipaddr.js';
import { IPV4_PREFIX_LENGTH, IPV6_PREFIX_LENGTH, LOCAL_IP_RANGES } from 'common/common.constants';

type IpAddress = ipaddr.IPv4 | ipaddr.IPv6;
type IpCidr = [IpAddress, number];

@Injectable()
export class LocalNetworkService implements OnModuleInit {
    private readonly logger = new Logger(LocalNetworkService.name);

    private readonly allowedCidrs: Array<IpCidr>;

    constructor(private readonly configService: ConfigService) {
        this.allowedCidrs = this.parseAllowedCidrs();
    }

    onModuleInit(): void {
        if (!this.isRestrictionEnabled()) {
            this.logger.warn('LOCAL_NETWORK_ONLY_ENABLED is disabled — local network only endpoints are reachable from any address');
            return;
        }
        if (this.configService.get<string>('TRUST_PROXY')?.trim() === 'true') {
            this.logger.warn(
                'TRUST_PROXY=true trusts the X-Forwarded-For header of any client, which makes it possible to spoof the client IP and bypass the local network restriction. Set TRUST_PROXY to the number of proxies in front of the server or to a comma-separated list of trusted proxy addresses instead',
            );
        }
    }

    isRestrictionEnabled(): boolean {
        return this.configService.get<string>('LOCAL_NETWORK_ONLY_ENABLED')?.trim() !== 'false';
    }

    // Relies on the express `trust proxy` setting (see TRUST_PROXY) to resolve the real client
    // IP from X-Forwarded-For when the server is running behind a reverse proxy
    isLocalRequest(request: Request): boolean {
        return this.isLocalAddress(request?.ip ?? request?.socket?.remoteAddress);
    }

    isLocalAddress(ip?: string): boolean {
        const address = this.parseAddress(ip);
        if (!address) {
            return false;
        }
        return LOCAL_IP_RANGES.includes(address.range()) || this.matchesAllowedCidr(address);
    }

    private matchesAllowedCidr(address: IpAddress): boolean {
        return this.allowedCidrs.some(
            ([network, prefixLength]) =>
                address.kind() === network.kind() && (address as ipaddr.IPv4).match(network as ipaddr.IPv4, prefixLength),
        );
    }

    private parseAllowedCidrs(): Array<IpCidr> {
        const rawCidrs = this.configService.get<string>('LOCAL_NETWORK_ALLOWED_CIDRS')?.trim();
        if (!rawCidrs) {
            return [];
        }
        return rawCidrs
            .split(',')
            .map(cidr => cidr.trim())
            .filter(Boolean)
            .map(cidr => this.parseCidr(cidr))
            .filter(Boolean);
    }

    private parseCidr(cidr: string): IpCidr | null {
        try {
            if (cidr.includes('/')) {
                return ipaddr.parseCIDR(cidr);
            }
            const address = ipaddr.process(cidr);
            return [address, address.kind() === 'ipv4' ? IPV4_PREFIX_LENGTH : IPV6_PREFIX_LENGTH];
        } catch {
            this.logger.warn(`Ignoring invalid entry in LOCAL_NETWORK_ALLOWED_CIDRS: ${cidr}`);
            return null;
        }
    }

    // Unwraps IPv4-mapped IPv6 addresses (e.g. ::ffff:192.168.1.5) so they are matched as IPv4
    private parseAddress(ip?: string): IpAddress | null {
        if (!ip?.trim()) {
            return null;
        }
        try {
            return ipaddr.process(ip.trim());
        } catch {
            return null;
        }
    }
}
