import { SetMetadata } from '@nestjs/common';

export const IS_LOCAL_NETWORK_ONLY_KEY = 'isLocalNetworkOnly';

export const LocalNetworkOnly = () => SetMetadata(IS_LOCAL_NETWORK_ONLY_KEY, true);
